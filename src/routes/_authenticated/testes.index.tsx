import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { FlaskConical, Plus, Zap, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { testsQuery, checklistsQuery } from '@/lib/tests';
import { testCommand } from '@/lib/tests.functions';
import { canCreateTest, TEST_MODE, TEST_STATUS } from '@/lib/test-rules';
import { flagsQuery, pageHead } from '@/lib/tasks';
import { useMe } from '@/lib/me';
import { fmtDateTime } from '@/lib/format';
import { TestForm } from '@/components/TestForm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export const Route = createFileRoute('/_authenticated/testes/')({
  head: () => pageHead('Testes e ensaios', 'Sessões, segurança, aprovações e resultados dos ensaios da equipe Aerodesign.'),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(testsQuery), context.queryClient.ensureQueryData(checklistsQuery), context.queryClient.ensureQueryData(flagsQuery)]),
  component: TestsPage,
});
function TestsPage() {
  const { data } = useSuspenseQuery(testsQuery); const { data: checklists } = useSuspenseQuery(checklistsQuery); const { data: flags } = useSuspenseQuery(flagsQuery); const { data: me } = useMe();
  const [form, setForm] = useState<'normal_test' | 'quick_test' | null>(null); const [mode, setMode] = useState('all'); const [state, setState] = useState('active');
  const [security, setSecurity] = useState(false); const [body, setBody] = useState(''); const [busy, setBusy] = useState(false);
  const command = useServerFn(testCommand); const qc = useQueryClient();
  const enabled = flags.some(f => f.key === 'testes' && f.enabled); const agendaEnabled = flags.some(f => f.key === 'agenda' && f.enabled);
  const rows = data.tests.filter(t => (mode === 'all' || t.mode === mode) && (state === 'archived' ? !!t.archived_at : !t.archived_at) && (['active', 'archived'].includes(state) || data.sessions.some(s => s.test_id === t.id && s.status === state)));
  async function saveChecklist(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await command({ data: { action: 'checklist', payload: { body } } }); await qc.invalidateQueries(); setBody(''); setSecurity(false); toast.success('Nova versão de segurança registrada.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.'); } finally { setBusy(false); }
  }
  return <div className="space-y-6"><header className="flex flex-wrap justify-between gap-4"><h1 className="flex items-center gap-2 text-2xl font-semibold"><FlaskConical className="h-6 w-6"/>Testes e ensaios</h1>{enabled && agendaEnabled && canCreateTest(me?.role) && <div className="flex flex-wrap gap-2"><Button onClick={() => setForm('normal_test')}><Plus className="h-4 w-4"/>{me?.role === 'membro' ? 'Propor teste' : 'Agendar teste'}</Button><Button variant="outline" onClick={() => setForm('quick_test')}><Zap className="h-4 w-4"/>Teste rápido</Button></div>}</header>
    {(!enabled || !agendaEnabled) && <p className="border-l-2 border-warning p-3 text-sm">Módulo desabilitado. Histórico preservado.</p>}
    <section className="space-y-3 border-y py-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5"/>Segurança</h2>{me?.role === 'capitao' && enabled && <Button variant="outline" onClick={() => setSecurity(v => !v)}>Registrar checklist</Button>}</div>{checklists[0] ? <details><summary className="cursor-pointer text-sm">Checklist vigente · Versão {checklists[0].version}</summary><p className="mt-3 whitespace-pre-wrap break-words text-sm">{checklists[0].body}</p></details> : <p className="text-sm text-muted-foreground">Nenhum checklist da equipe registrado.</p>}{security && <form className="space-y-3" onSubmit={saveChecklist}><Label htmlFor="checklist-body">Checklist de segurança da equipe</Label><Textarea id="checklist-body" required rows={6} value={body} onChange={e => setBody(e.target.value)}/><Button disabled={busy || !body.trim()} type="submit">Salvar nova versão</Button></form>}</section>
    <div className="grid gap-3 sm:grid-cols-2"><select aria-label="Modalidade de teste" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={mode} onChange={e => setMode(e.target.value)}><option value="all">Todas as modalidades</option><option value="normal_test">Testes normais</option><option value="quick_test">Testes rápidos</option></select><select aria-label="Situação dos testes" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={state} onChange={e => setState(e.target.value)}><option value="active">Não arquivados</option>{Object.entries(TEST_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}<option value="archived">Arquivados</option></select></div>
    <section className="divide-y">{rows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhum teste neste filtro.</p>}{rows.map(t => { const sessions = data.sessions.filter(s => s.test_id === t.id); const latest = sessions.at(-1); const event = data.events.find(e => e.id === latest?.event_id); return <Link key={t.id} to="/testes/$testId" params={{ testId: t.id }} className="flex flex-wrap justify-between gap-3 py-5"><div className="min-w-0"><p className="text-xs text-muted-foreground">#{t.code} · {TEST_MODE[t.mode as keyof typeof TEST_MODE]} · {sessions.length} sessão(ões)</p><h2 className="mt-1 break-words font-semibold">{t.title}</h2><p className="mt-1 break-words text-sm text-muted-foreground">{t.type}{event ? ` · ${fmtDateTime(event.starts_at)} · ${event.location}` : ''}</p></div><span className={`text-sm ${latest?.status === 'pending' ? 'text-warning' : 'text-primary'}`}>{latest ? TEST_STATUS[latest.status] : 'Sem sessões'}</span></Link>; })}</section>
    {form && <TestForm mode={form} onClose={() => setForm(null)}/>}
  </div>;
}