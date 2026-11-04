import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { problemsQuery, useTechSave, blank } from '@/lib/technical';
import { PROBLEM_STATUS, CRITICALITY, PROBLEM_SCOPE, managesSector, closureMissing } from '@/lib/technical-rules';
import { meQuery, membersQuery, sectorsQuery } from '@/lib/me';
import { pageHead, fmtDate } from '@/lib/format';
import { Field, Pick, FormToggle, Empty, Info, TechHistory } from '@/components/TechUI';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/problemas')({
  head: () => pageHead('Problemas e não conformidades', 'Registro, triagem e fechamento de problemas técnicos da equipe.'),
  loader: ({ context }) => Promise.all([problemsQuery, meQuery, membersQuery, sectorsQuery].map(q => context.queryClient.ensureQueryData(q as never))),
  component: ProblemsPage,
});

function ProblemsPage() {
  const { data } = useSuspenseQuery(problemsQuery); const { data: me } = useSuspenseQuery(meQuery);
  const { data: members } = useSuspenseQuery(membersQuery); const { data: sectors } = useSuspenseQuery(sectorsQuery);
  const names = new Map(members.map(m => [m.id, m.full_name || m.email])); const save = useTechSave();
  const [filter, setFilter] = useState('abertos');
  const list = data.filter(p => filter === 'todos' || (filter === 'abertos' ? p.status !== 'closed' : p.status === 'closed'));
  return <div className="space-y-6">
    <h1 className="flex items-center gap-2 text-2xl font-semibold"><AlertTriangle className="h-6 w-6" />Problemas e não conformidades</h1>
    <p className="text-sm text-muted-foreground">Qualquer integrante registra. A gerência do setor ou o capitão fazem a triagem; o fechamento exige documentação.</p>
    <div className="flex flex-wrap items-center gap-3">
      <FormToggle label="Registrar problema" pending={save.isPending} onSubmit={f => save.mutateAsync(() => supabase.from('problems').insert({
        title: String(f.get('title')), description: String(f.get('description')), sector_id: Number(f.get('sector_id')), scope: String(f.get('scope')), criticality: String(f.get('criticality')),
        occurred_on: String(f.get('occurred_on')), circumstances: blank(f.get('circumstances')), created_by: me!.id }))}>
        <Field label="Título" name="title" required /><Pick label="Setor responsável" name="sector_id" required options={sectors.map(s => [String(s.id), s.name])} defaultValue={me?.sector_id} />
        <Pick label="Abrangência" name="scope" required options={Object.entries(PROBLEM_SCOPE)} /><Pick label="Criticidade" name="criticality" required options={Object.entries(CRITICALITY)} />
        <Field label="Data da ocorrência" name="occurred_on" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /><Field label="Circunstâncias" name="circumstances" area />
        <div className="sm:col-span-2"><Field label="Descrição" name="description" required area /></div>
      </FormToggle>
      <select aria-label="Filtro" value={filter} onChange={e => setFilter(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm"><option value="abertos">Em aberto</option><option value="fechados">Fechados</option><option value="todos">Todos</option></select>
    </div>
    {list.length === 0 && <Empty>Nenhum problema nesta lista.</Empty>}
    <div className="space-y-3">{list.map(p => {
      const manage = managesSector(me, p.sector_id);
      return <article key={p.id} className="space-y-2 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">#{p.code} · {p.title}</h2>
          <span className="text-xs"><span className="rounded bg-muted px-2 py-0.5">{PROBLEM_STATUS[p.status]}</span> <span className={p.criticality === 'critica' || p.criticality === 'alta' ? 'font-semibold text-destructive' : ''}>{CRITICALITY[p.criticality]}</span></span></div>
        <p className="text-xs text-muted-foreground">{sectors.find(s => s.id === p.sector_id)?.name} · {PROBLEM_SCOPE[p.scope]} · {fmtDate(p.occurred_on)} · registrado por {names.get(p.created_by)}</p>
        <Info label="Descrição" value={p.description} /><Info label="Circunstâncias" value={p.circumstances} /><Info label="Triagem" value={p.triage_by ? names.get(p.triage_by) : null} />
        <Info label="Ações" value={p.actions} /><Info label="Solução" value={p.solution} /><Info label="Fechamento" value={p.closure_note} />
        {manage && <form className="grid gap-2 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const st = String(f.get('status')); const note = blank(f.get('closure_note'));
          if (closureMissing(st, note)) { toast.error('Documente o fechamento do problema.'); return; }
          save.mutate(() => supabase.from('problems').update({ status: st, triage_by: p.triage_by ?? me!.id, actions: blank(f.get('actions')), solution: blank(f.get('solution')), closure_note: note }).eq('id', p.id)); }}>
          <Pick label="Situação" name="status" required options={Object.entries(PROBLEM_STATUS)} defaultValue={p.status} /><Field label="Ações tomadas" name="actions" defaultValue={p.actions} />
          <Field label="Solução" name="solution" area defaultValue={p.solution} /><Field label="Documentação do fechamento" name="closure_note" area defaultValue={p.closure_note} />
          <button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground sm:w-fit" disabled={save.isPending}>Atualizar</button>
        </form>}
        <TechHistory kind="problem" id={p.id} names={names} />
      </article>;
    })}</div>
  </div>;
}
