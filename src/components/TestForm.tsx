import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { testCommand } from '@/lib/tests.functions';
import { checklistsQuery, type TeamTest } from '@/lib/tests';
import { useMe, membersQuery, sectorsQuery } from '@/lib/me';
import { spLocalToISO } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function TestForm({ mode, current, onClose }: { mode: 'normal_test' | 'quick_test'; current?: TeamTest; onClose: () => void }) {
  const { data: me } = useMe();
  const { data: members = [] } = useQuery(membersQuery);
  const { data: sectors = [] } = useQuery(sectorsQuery);
  const { data: checklists = [] } = useQuery(checklistsQuery);
  const command = useServerFn(testCommand); const qc = useQueryClient(); const navigate = useNavigate();
  const [sector, setSector] = useState(current?.sector_id ?? me?.sector_id ?? 1);
  const [organizer, setOrganizer] = useState(me?.id ?? '');
  const [people, setPeople] = useState<string[]>(me ? [me.id] : []);
  const [accepted, setAccepted] = useState(false); const [busy, setBusy] = useState(false);
  const checklist = checklists[0];
  const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
  const eligible = members.filter(p => p.active && (me?.role === 'capitao' || p.sector_id === sector));
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!checklist || !accepted) return;
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? '').trim();
    if (mode === 'normal_test' && value('ends_at') <= value('starts_at')) { toast.error('O término deve ser posterior ao início.'); return; }
    setBusy(true);
    try {
      const result = await command({ data: { action: current ? 'session' : 'create', test: current?.id, payload: {
        title: value('title'), type: value('type'), objective: value('objective'), mode, sector_id: sector,
        organizer_id: organizer, participants: people, location: value('location'), conditions: value('conditions'),
        configuration: value('configuration'), equipment: value('equipment'), materials: value('materials'), procedure: value('procedure'), observations: value('observations'),
        ...(mode === 'normal_test' ? { starts_at: spLocalToISO(value('starts_at')), ends_at: spLocalToISO(value('ends_at')) } : {}),
        safety_accepted: accepted, checklist_id: checklist.id,
      } } });
      await qc.invalidateQueries(); toast.success(mode === 'quick_test' ? 'Teste rápido iniciado.' : me?.role === 'membro' ? 'Proposta enviada para aprovação.' : 'Sessão agendada.');
      onClose(); navigate({ to: '/testes/$testId', params: { testId: result.id } });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.'); } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={onClose}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{current ? 'Nova sessão' : mode === 'quick_test' ? 'Iniciar teste rápido' : me?.role === 'membro' ? 'Propor teste normal' : 'Agendar teste normal'}</DialogTitle></DialogHeader>
    <form onSubmit={save} className="space-y-4">
      {!current && <>{[['title', 'Nome do teste'], ['type', 'Tipo de ensaio']].map(([name, label]) => <div key={name} className="space-y-2"><Label htmlFor={`test-${name}`}>{label}</Label><Input id={`test-${name}`} name={name} required maxLength={160}/></div>)}<div className="space-y-2"><Label htmlFor="test-objective">Objetivo</Label><Textarea id="test-objective" name="objective" required/></div></>}
      {mode === 'normal_test' && <div className="grid gap-4 sm:grid-cols-2">{[['starts_at', 'Início (Brasília)'], ['ends_at', 'Término (Brasília)']].map(([name, label]) => <div key={name} className="space-y-2"><Label htmlFor={`test-${name}`}>{label}</Label><Input type="datetime-local" id={`test-${name}`} name={name} required/></div>)}</div>}
      <div className="space-y-2"><Label htmlFor="test-location">Local</Label><Input id="test-location" name="location" required/></div>
      {!current && <div className="space-y-2"><Label htmlFor="test-sector">Setor responsável</Label><select id="test-sector" className={selectClass} value={sector} disabled={me?.role !== 'capitao'} onChange={e => setSector(Number(e.target.value))}>{sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
      <div className="space-y-2"><Label htmlFor="test-organizer">Responsável pela sessão</Label><select id="test-organizer" className={selectClass} value={organizer} disabled={me?.role === 'membro' && mode === 'normal_test'} onChange={e => setOrganizer(e.target.value)}>{eligible.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</select></div>
      <fieldset><legend className="mb-2 text-sm font-medium">Participantes</legend><div className="max-h-40 space-y-3 overflow-auto border-y py-3">{eligible.map(p => <label key={p.id} className="flex items-start gap-2 text-sm"><Checkbox checked={people.includes(p.id)} onCheckedChange={v => setPeople(ids => v === true ? [...ids, p.id] : ids.filter(id => id !== p.id))}/><span className="break-words">{p.full_name || p.email}</span></label>)}</div></fieldset>
      <details><summary className="cursor-pointer text-sm font-medium">Campos complementares</summary><div className="mt-3 space-y-3">{(current ? [['conditions', 'Condições da sessão']] : [['configuration', 'Configuração da aeronave'], ['materials', 'Materiais'], ['equipment', 'Equipamentos'], ['procedure', 'Procedimento'], ['observations', 'Observações'], ['conditions', 'Condições da sessão']]).map(([name, label]) => <div key={name} className="space-y-2"><Label htmlFor={`test-${name}`}>{label} — opcional</Label><Textarea id={`test-${name}`} name={name}/></div>)}</div></details>
      <section className="space-y-3 border-y py-4"><h3 className="font-semibold">Segurança{checklist ? ` · Versão ${checklist.version}` : ''}</h3>{checklist ? <><p className="whitespace-pre-wrap break-words text-sm">{checklist.body}</p><label className="flex items-start gap-2 text-sm"><Checkbox checked={accepted} onCheckedChange={v => setAccepted(v === true)}/>Li e estou ciente deste checklist de segurança.</label></> : <p className="text-sm text-warning">O capitão precisa registrar o checklist de segurança da equipe antes de iniciar ou agendar testes.</p>}</section>
      <Button type="submit" className="w-full" disabled={busy || !checklist || !accepted}>{busy ? 'Salvando…' : mode === 'quick_test' ? 'Iniciar agora' : me?.role === 'membro' ? 'Enviar proposta' : 'Agendar sessão'}</Button>
    </form>
  </DialogContent></Dialog>;
}