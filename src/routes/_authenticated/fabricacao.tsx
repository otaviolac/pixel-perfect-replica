import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Hammer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fabricationQuery, aircraftQuery, useTechSave, blank } from '@/lib/technical';
import { FAB_STATUS, managesSector } from '@/lib/technical-rules';
import { meQuery, membersQuery, sectorsQuery } from '@/lib/me';
import { pageHead, fmtDate } from '@/lib/format';
import { Field, Pick, FormToggle, Empty, Info, TechHistory } from '@/components/TechUI';

export const Route = createFileRoute('/_authenticated/fabricacao')({
  head: () => pageHead('Fabricação', 'Componentes, responsáveis e andamento da fabricação da aeronave.'),
  loader: ({ context }) => Promise.all([fabricationQuery, aircraftQuery, meQuery, membersQuery, sectorsQuery].map(q => context.queryClient.ensureQueryData(q as never))),
  component: FabricationPage,
});

function FabricationPage() {
  const { data } = useSuspenseQuery(fabricationQuery); const { data: ac } = useSuspenseQuery(aircraftQuery);
  const { data: me } = useSuspenseQuery(meQuery); const { data: members } = useSuspenseQuery(membersQuery); const { data: sectors } = useSuspenseQuery(sectorsQuery);
  const names = new Map(members.map(m => [m.id, m.full_name || m.email])); const save = useTechSave();
  const mine = sectors.filter(s => managesSector(me, s.id)).map(s => [String(s.id), s.name] as [string, string]);
  const people = members.filter(m => m.active).map(m => [m.id, m.full_name || m.email] as [string, string]);
  return <div className="space-y-6">
    <h1 className="flex items-center gap-2 text-2xl font-semibold"><Hammer className="h-6 w-6" />Fabricação</h1>
    <p className="text-sm text-muted-foreground">A gerência do setor e o capitão cadastram componentes; o responsável atualiza estado, datas e observações.</p>
    {mine.length > 0 && <FormToggle label="Novo componente" pending={save.isPending} onSubmit={f => save.mutateAsync(() => supabase.from('fabrication_items').insert({
      name: String(f.get('name')), sector_id: Number(f.get('sector_id')), responsible_id: String(f.get('responsible_id')), aircraft_id: blank(f.get('aircraft_id')), parent_id: blank(f.get('parent_id')),
      description: blank(f.get('description')), start_date: blank(f.get('start_date')), due_date: blank(f.get('due_date')), created_by: me!.id }))}>
      <Field label="Componente" name="name" required /><Pick label="Setor" name="sector_id" required options={mine} defaultValue={me?.sector_id} />
      <Pick label="Responsável" name="responsible_id" required options={people} empty="Selecione" /><Pick label="Aeronave" name="aircraft_id" options={ac.aircraft.map(a => [a.id, a.name])} />
      <Pick label="Subcomponente de" name="parent_id" options={data.map(i => [i.id, i.name])} /><Field label="Início" name="start_date" type="date" />
      <Field label="Previsão" name="due_date" type="date" /><Field label="Descrição" name="description" area />
    </FormToggle>}
    {data.length === 0 && <Empty>Nenhum componente cadastrado.</Empty>}
    <div className="space-y-3">{data.map(i => {
      const manage = managesSector(me, i.sector_id); const canEdit = manage || i.responsible_id === me?.id;
      return <article key={i.id} className="space-y-2 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">{i.name}</h2><span className="rounded bg-muted px-2 py-0.5 text-xs">{FAB_STATUS[i.status]}</span></div>
        <Info label="Setor" value={sectors.find(s => s.id === i.sector_id)?.name} /><Info label="Responsável" value={names.get(i.responsible_id)} />
        <Info label="Subcomponente de" value={data.find(p => p.id === i.parent_id)?.name} /><Info label="Descrição" value={i.description} />
        <Info label="Início" value={i.start_date ? fmtDate(i.start_date) : null} /><Info label="Previsão" value={i.due_date ? fmtDate(i.due_date) : null} /><Info label="Concluído em" value={i.done_date ? fmtDate(i.done_date) : null} />
        <Info label="Observações" value={i.observations} />
        {canEdit && <form className="grid gap-2 sm:grid-cols-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const st = String(f.get('status'));
          save.mutate(() => supabase.from('fabrication_items').update({ status: st, start_date: blank(f.get('start_date')), due_date: blank(f.get('due_date')), done_date: st === 'done' ? (blank(f.get('done_date')) ?? new Date().toISOString().slice(0, 10)) : null, observations: blank(f.get('observations')) }).eq('id', i.id)); }}>
          <Pick label="Estado" name="status" required options={Object.entries(FAB_STATUS)} defaultValue={i.status} /><Field label="Início" name="start_date" type="date" defaultValue={i.start_date} />
          <Field label="Previsão" name="due_date" type="date" defaultValue={i.due_date} /><Field label="Conclusão" name="done_date" type="date" defaultValue={i.done_date} />
          <div className="sm:col-span-3"><Field label="Observações" name="observations" defaultValue={i.observations} /></div>
          <button className="self-end rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" disabled={save.isPending}>Atualizar</button>
        </form>}
        {manage && <button className="text-xs text-muted-foreground underline" onClick={() => confirm('Arquivar este componente?') && save.mutate(() => supabase.from('fabrication_items').update({ archived_at: new Date().toISOString() }).eq('id', i.id))}>Arquivar</button>}
        <TechHistory kind="fabrication" id={i.id} names={names} />
      </article>;
    })}</div>
  </div>;
}
