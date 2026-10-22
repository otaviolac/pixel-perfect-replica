import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { ArrowLeft, Plus, Check, X, Archive, Play, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { testDetailQuery, checklistsQuery } from '@/lib/tests';
import { testCommand } from '@/lib/tests.functions';
import { canAddTestSession, canManageTest, TEST_MODE, TEST_STATUS, sessionTransitions, resultsRequired } from '@/lib/test-rules';
import { flagsQuery, pageHead } from '@/lib/tasks';
import { useMe, membersQuery, sectorsQuery } from '@/lib/me';
import { fmtDateTime } from '@/lib/format';
import { TestForm } from '@/components/TestForm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AttendancePanel } from '@/components/AttendancePanel';
import { eventAttendanceQuery } from '@/lib/attendance';
import type { Tables } from '@/integrations/supabase/types';
import { agendaCommand } from '@/lib/agenda.functions';
import { INVITE_KIND, RESPONSE } from '@/lib/agenda-rules';

export const Route = createFileRoute('/_authenticated/testes/$testId')({
  head: () => pageHead('Ficha de teste', 'Objetivo, sessões, segurança, participantes e resultados do ensaio Aerodesign.'),
  loader: async ({ context, params }) => {
    const detail = await context.queryClient.ensureQueryData(testDetailQuery(params.testId));
    await Promise.all([context.queryClient.ensureQueryData(checklistsQuery), context.queryClient.ensureQueryData(flagsQuery), ...detail.events.map(e => context.queryClient.ensureQueryData(eventAttendanceQuery(e.id)))]);
  }, component: TestDetail,
});
function TestDetail() {
  const { testId } = Route.useParams(); const { data } = useSuspenseQuery(testDetailQuery(testId)); const { data: flags } = useSuspenseQuery(flagsQuery);
  const { data: checklists } = useSuspenseQuery(checklistsQuery); const { data: me } = useMe(); const { data: members = [] } = useQuery(membersQuery); const { data: sectors = [] } = useQuery(sectorsQuery);
  const qc = useQueryClient(); const command = useServerFn(testCommand); const [busy, setBusy] = useState(false); const [form, setForm] = useState(false); const [selected, setSelected] = useState(data.sessions[0]?.id ?? '');
  const session = data.sessions.find(s => s.id === selected) ?? data.sessions[0]; const event = data.events.find(e => e.id === session?.event_id);
  const enabled = flags.some(f => f.key === 'testes' && f.enabled) && flags.some(f => f.key === 'agenda' && f.enabled) && !data.test.archived_at;
  const manager = !!event && canManageTest(me, data.test.sector_id, event.organizer_id); const owner = !!me && me.id === event?.organizer_id;
  const person = (id: string) => members.find(p => p.id === id)?.full_name || members.find(p => p.id === id)?.email || 'Integrante';
  const invitees = data.invitees.filter(i => i.event_id === event?.id);
  async function act(action: 'approve' | 'reject' | 'results' | 'status' | 'invite' | 'decide' | 'archive', payload: Record<string, unknown> = {}) {
    if (!session) return;
    setBusy(true);
    try { await command({ data: { action, test: testId, session: session.id, payload } }); await qc.invalidateQueries(); toast.success('Teste atualizado.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar.'); } finally { setBusy(false); }
  }
  const labels: Record<string, string> = { test_create: 'Teste criado', test_session: 'Sessão adicionada', test_approve: 'Teste aprovado', test_reject: 'Teste não aprovado', test_results: 'Resultados registrados', test_status: 'Situação alterada', test_invite: 'Setor convidado', test_decide: 'Convite respondido', test_archive: 'Teste arquivado', respond: 'Resposta de participação', attendance_toggle: 'Chamada alterada', attendance_summon: 'Convocação registrada' };
  return <div className="space-y-6"><Link to="/testes" className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4"/>Testes e ensaios</Link>
    <header className="space-y-3 border-b pb-5"><div className="flex flex-wrap justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted-foreground">#{data.test.code} · {TEST_MODE[data.test.mode as keyof typeof TEST_MODE]}{data.test.archived_at ? ' · Arquivado' : ''}</p><h1 className="mt-2 break-words text-2xl font-semibold">{data.test.title}</h1></div>{enabled && canAddTestSession(me, data.test) && <Button variant="outline" onClick={() => setForm(true)}><Plus className="h-4 w-4"/>Nova sessão</Button>}</div><p className="break-words text-sm text-muted-foreground">{data.test.type} · {sectors.find(s => s.id === data.test.sector_id)?.name}</p><h2 className="font-semibold">Objetivo</h2><p className="whitespace-pre-wrap break-words text-sm">{data.test.objective}</p></header>
    {!enabled && <p className="text-sm text-muted-foreground">Registro em consulta. Histórico preservado.</p>}
    {[['Configuração da aeronave', data.test.configuration], ['Materiais', data.test.materials], ['Equipamentos', data.test.equipment], ['Procedimento', data.test.procedure], ['Observações', data.test.observations]].filter(([, text]) => text).map(([label, text]) => <section key={label} className="space-y-2"><h2 className="font-semibold">{label}</h2><p className="whitespace-pre-wrap break-words text-sm">{text}</p></section>)}
    <section className="space-y-4"><h2 className="font-semibold">Sessões</h2><select aria-label="Sessão do teste" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={session?.id ?? ''} onChange={e => setSelected(e.target.value)}>{data.sessions.map((s, i) => <option key={s.id} value={s.id}>Sessão {i + 1} · {TEST_STATUS[s.status]}</option>)}</select>
      {session && event && <><div className="space-y-2 border-l-2 border-primary pl-4"><p className={`font-medium ${session.status === 'pending' ? 'text-warning' : 'text-primary'}`}>{TEST_STATUS[session.status]}</p><p className="text-sm">{fmtDateTime(event.starts_at)} — {fmtDateTime(event.ends_at)}</p><p className="break-words text-sm">{event.location} · Responsável: {person(event.organizer_id)}</p><Link className="text-sm text-primary underline" to="/agenda/$eventId" params={{ eventId: event.id }}>Ver na agenda</Link></div>
        {enabled && session.status === 'pending' && <section className="space-y-3 border-l-2 border-warning p-4"><h3 className="font-semibold">Teste pendente de aprovação</h3><p className="text-sm">Os indicados receberam somente aviso informativo.</p>{manager && <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => act('approve')}><Check className="h-4 w-4"/>Aprovar teste</Button><Button variant="outline" disabled={busy} onClick={() => act('reject')}><X className="h-4 w-4"/>Não aprovar</Button></div>}</section>}
        <SessionResults key={session.id} session={session} editable={enabled && (manager || owner) && !['pending', 'rejected', 'cancelled'].includes(session.status)} manager={manager} owner={owner} busy={busy} act={act}/>
        <TestParticipants key={`people-${session.id}`} event={event} invitees={invitees} invitations={data.invitations.filter(i => i.session_id === session.id)} normal={data.test.mode === 'normal_test'} enabled={enabled} manager={manager} busy={busy} act={act}/>
        <section className="space-y-3 border-t pt-4"><h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4"/>Ciência de segurança</h3>{data.acknowledgments.filter(a => a.session_id === session.id).map(a => <div key={a.id} className="space-y-2 text-sm"><p className="break-words">{person(a.user_id)} · {fmtDateTime(a.created_at)} · Versão {checklists.find(c => c.id === a.checklist_id)?.version ?? 'registrada'} · Aceite registrado</p><details><summary className="cursor-pointer text-xs text-muted-foreground">Checklist aceito</summary><p className="mt-2 whitespace-pre-wrap break-words">{checklists.find(c => c.id === a.checklist_id)?.body}</p></details></div>)}</section>
        {data.test.mode === 'normal_test' && <AttendancePanel event={event} invitees={invitees} manager={manager} owner={owner} enabled={enabled && !['pending', 'rejected'].includes(session.status)} person={person} canSummon={id => me?.role === 'capitao' || (me?.role === 'gerente' && members.some(p => p.id === id && p.sector_id === me.sector_id))}/>}
        {enabled && manager && data.sessions.every(s => !['pending', 'scheduled', 'running', 'result_pending'].includes(s.status)) && <Button variant="outline" disabled={busy} onClick={() => act('archive')}><Archive className="h-4 w-4"/>Arquivar teste</Button>}
      </>}
    </section>
    <section className="space-y-3 border-t pt-5"><h2 className="font-semibold">Histórico da sessão</h2><div className="divide-y">{data.history.filter(h => h.event_id === event?.id).map(h => <p key={h.id} className="break-words py-3 text-xs text-muted-foreground">{labels[h.action] ?? 'Registro atualizado'} · {person(h.actor_id)} · {fmtDateTime(h.created_at)}{h.action === 'test_status' && typeof h.details === 'object' && h.details && !Array.isArray(h.details) && typeof h.details['note'] === 'string' ? ` · ${h.details['note']}` : ''}</p>)}</div></section>
    {form && <TestForm current={data.test} mode={data.test.mode as 'normal_test' | 'quick_test'} onClose={() => setForm(false)}/>}
  </div>;
}
type Act = (action: 'approve' | 'reject' | 'results' | 'status' | 'invite' | 'decide' | 'archive', payload?: Record<string, unknown>) => Promise<void>;
function SessionResults({ session, editable, manager, owner, busy, act }: { session: Tables<'test_sessions'>; editable: boolean; manager: boolean; owner: boolean; busy: boolean; act: Act }) {
  const [results, setResults] = useState<string | null>(null); const [conditions, setConditions] = useState<string | null>(null); const [note, setNote] = useState<string | null>(null);
  const transitions = editable ? sessionTransitions(session.status, manager, owner) : [];
  return <section className="space-y-3 border-y py-4"><h3 className="font-semibold">Registros e resultados da sessão</h3>{editable ? <><Label htmlFor="session-conditions">Condições — opcional</Label><Textarea id="session-conditions" value={conditions ?? session.conditions} onChange={e => setConditions(e.target.value)}/><Label htmlFor="session-results">Resultados</Label><Textarea id="session-results" rows={5} value={results ?? session.results} onChange={e => setResults(e.target.value)}/><Label htmlFor="session-note">Observação / motivo</Label><Textarea id="session-note" value={note ?? session.note} onChange={e => setNote(e.target.value)}/><Button variant="outline" disabled={busy} onClick={() => act('results', { results: results ?? session.results, conditions: conditions ?? session.conditions, note: note ?? session.note })}>Salvar registros</Button></> : <>{session.conditions && <p className="whitespace-pre-wrap break-words text-sm">Condições: {session.conditions}</p>}<p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{session.results || 'Nenhum resultado registrado.'}</p>{session.note && <p className="whitespace-pre-wrap break-words text-sm">{session.note}</p>}</>}
    <div className="flex flex-wrap gap-2">{transitions.map(status => <Button key={status} variant={status === 'running' || status === 'completed' ? 'default' : 'outline'} disabled={busy || resultsRequired(status, session.results) || (status === 'interrupted' && !(note ?? session.note).trim())} onClick={() => act('status', { status, note: note ?? session.note })}>{status === 'running' && <Play className="h-4 w-4"/>}{status === 'running' ? 'Iniciar sessão' : status === 'result_pending' ? 'Registrar realização' : status === 'completed' ? 'Concluir teste' : status === 'interrupted' ? 'Interromper teste' : status === 'cancelled' ? 'Cancelar sessão' : 'Marcar inconclusivo'}</Button>)}</div>
  </section>;
}
function TestParticipants({ event, invitees, invitations, normal, enabled, manager, busy, act }: { event: Tables<'agenda_events'>; invitees: Tables<'agenda_invitees'>[]; invitations: Tables<'test_sector_invitations'>[]; normal: boolean; enabled: boolean; manager: boolean; busy: boolean; act: Act }) {
  const { data: me } = useMe(); const { data: members = [] } = useQuery(membersQuery); const { data: sectors = [] } = useQuery(sectorsQuery); const qc = useQueryClient(); const respond = useServerFn(agendaCommand);
  const [sector, setSector] = useState(''); const [people, setPeople] = useState<Record<string, string[]>>({}); const [responding, setResponding] = useState(false);
  const mine = invitees.find(i => i.user_id === me?.id);
  async function answer(response: 'yes' | 'no') { setResponding(true); try { await respond({ data: { action: 'respond', event: event.id, payload: { response } } }); await qc.invalidateQueries(); toast.success('Resposta registrada.'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível responder.'); } finally { setResponding(false); } }
  return <section className="space-y-4"><h3 className="font-semibold">Participantes</h3>{enabled && event.status === 'scheduled' && mine && mine.kind !== 'notice' && <div className="flex flex-wrap gap-2"><Button disabled={responding} variant={mine.response === 'yes' ? 'default' : 'outline'} onClick={() => answer('yes')}>Vou participar</Button><Button disabled={responding} variant={mine.response === 'no' ? 'secondary' : 'outline'} onClick={() => answer('no')}>Não poderei</Button></div>}<div className="divide-y">{invitees.map(i => <div key={i.user_id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="break-words">{members.find(p => p.id === i.user_id)?.full_name || 'Integrante'}</span><span className="text-xs text-muted-foreground">{INVITE_KIND[i.kind]}{i.kind !== 'notice' ? ` · ${RESPONSE[i.response]}` : ''}</span></div>)}</div>
    {enabled && normal && manager && event.status === 'scheduled' && <div className="flex flex-wrap gap-2"><select aria-label="Setor para convidar ao teste" className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" value={sector} onChange={e => setSector(e.target.value)}><option value="">Escolher setor</option>{sectors.filter(s => s.id !== event.sector_id && !invitations.some(i => i.sector_id === s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><Button disabled={busy || !sector} variant="outline" onClick={() => act('invite', { sector_id: Number(sector) })}>Convidar setor</Button></div>}
    {invitations.map(i => { const decide = enabled && event.status === 'scheduled' && i.status === 'pending' && (me?.role === 'capitao' || (me?.role === 'gerente' && me.sector_id === i.sector_id)); return <div key={i.id} className="space-y-3 border-t py-3"><p className="text-sm font-medium">{sectors.find(s => s.id === i.sector_id)?.name} · {i.status === 'pending' ? 'Aguardando gerente' : i.status === 'accepted' ? 'Aceito' : 'Recusado'}</p>{decide && <><div className="space-y-2">{members.filter(p => p.active && p.sector_id === i.sector_id).map(p => <label key={p.id} className="flex items-start gap-2 text-sm"><Checkbox checked={(people[i.id] ?? []).includes(p.id)} onCheckedChange={value => setPeople(all => ({ ...all, [i.id]: value === true ? [...(all[i.id] ?? []), p.id] : (all[i.id] ?? []).filter(id => id !== p.id) }))}/><span className="break-words">{p.full_name || p.email}</span></label>)}</div><div className="flex flex-wrap gap-2"><Button disabled={busy || !people[i.id]?.length} onClick={() => act('decide', { invitation_id: i.id, status: 'accepted', participants: people[i.id] })}>Aceitar e indicar integrantes</Button><Button variant="outline" disabled={busy} onClick={() => act('decide', { invitation_id: i.id, status: 'rejected' })}>Recusar convite</Button></div></>}</div>; })}
  </section>;
}