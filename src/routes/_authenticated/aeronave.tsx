import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Plane } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { aircraftQuery, paramHistoryQuery, useTechSave, blank } from '@/lib/technical';
import { AIRCRAFT_CATEGORY, VALUE_ORIGIN, canEditAircraft, parameterValue } from '@/lib/technical-rules';
import { meQuery, membersQuery } from '@/lib/me';
import { pageHead, fmtDateTime } from '@/lib/format';
import { Field, Pick, FormToggle, Empty } from '@/components/TechUI';

export const Route = createFileRoute('/_authenticated/aeronave')({
  head: () => pageHead('Dados da aeronave', 'Parâmetros técnicos versionados da aeronave da equipe Aerodesign.'),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(aircraftQuery), context.queryClient.ensureQueryData(meQuery), context.queryClient.ensureQueryData(membersQuery)]),
  component: AircraftPage,
});

function numberOrNull(v: FormDataEntryValue | null) { const s = String(v ?? '').trim().replace(',', '.'); if (!s) return null; const n = Number(s); if (!Number.isFinite(n)) throw new Error('Valor numérico inválido.'); return n; }

function AircraftPage() {
  const { data } = useSuspenseQuery(aircraftQuery); const { data: me } = useSuspenseQuery(meQuery); const { data: members } = useSuspenseQuery(membersQuery);
  const names = new Map(members.map(m => [m.id, m.full_name || m.email]));
  const save = useTechSave(); const edit = canEditAircraft(me?.role);
  const [sel, setSel] = useState(data.aircraft[0]?.id ?? '');
  const current = data.aircraft.find(a => a.id === sel) ?? data.aircraft[0];
  const params = data.params.filter(p => p.aircraft_id === current?.id);
  return <div className="space-y-6">
    <h1 className="flex items-center gap-2 text-2xl font-semibold"><Plane className="h-6 w-6" />Dados da aeronave</h1>
    <p className="text-sm text-muted-foreground">Gerentes e capitão editam; todos os integrantes consultam. Dado não informado aparece como “Pendente”.</p>
    <div className="flex flex-wrap items-end gap-3">
      {data.aircraft.length > 0 && <select aria-label="Aeronave" value={current?.id} onChange={e => setSel(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">{data.aircraft.map(a => <option key={a.id} value={a.id}>{a.name}{a.project ? ` — ${a.project}` : ''}</option>)}</select>}
      {edit && <FormToggle label="Nova aeronave" pending={save.isPending} onSubmit={f => save.mutateAsync(() => supabase.from('aircraft').insert({ name: String(f.get('name')), project: blank(f.get('project')), created_by: me!.id }))}>
        <Field label="Nome" name="name" required /><Field label="Projeto / ano" name="project" />
      </FormToggle>}
    </div>
    {!current ? <Empty>Nenhuma aeronave cadastrada.</Empty> : <>
      {edit && <FormToggle label="Novo parâmetro" pending={save.isPending} onSubmit={f => save.mutateAsync(() => supabase.from('aircraft_parameters').insert({ aircraft_id: current.id, category: String(f.get('category')), name: String(f.get('name')), unit: String(f.get('unit')), value: numberOrNull(f.get('value')), text_value: blank(f.get('text_value')), origin: blank(f.get('origin')), note: blank(f.get('note')), updated_by: me!.id }))}>
        <Pick label="Categoria" name="category" required options={Object.entries(AIRCRAFT_CATEGORY)} /><Field label="Parâmetro" name="name" required />
        <Field label="Unidade" name="unit" required /><Field label="Valor numérico (deixe vazio se pendente)" name="value" />
        <Field label="Valor textual (opcional)" name="text_value" /><Pick label="Origem" name="origin" options={Object.entries(VALUE_ORIGIN)} />
        <Field label="Observação" name="note" area />
      </FormToggle>}
      {Object.entries(AIRCRAFT_CATEGORY).map(([cat, label]) => {
        const list = params.filter(p => p.category === cat); if (!list.length) return null;
        return <section key={cat}><h2 className="mb-2 font-semibold">{label}</h2><div className="divide-y rounded-lg border">{list.map(p => <ParamRow key={p.id} p={p} edit={edit} names={names} />)}</div></section>;
      })}
      {params.length === 0 && <Empty>Nenhum parâmetro registrado para esta aeronave.</Empty>}
    </>}
  </div>;
}

function ParamRow({ p, edit, names }: { p: Tables<'aircraft_parameters'>; edit: boolean; names: Map<string, string> }) {
  const [editing, setEditing] = useState(false); const [hist, setHist] = useState(false); const save = useTechSave();
  const { data: history = [] } = useQuery({ ...paramHistoryQuery(p.id), enabled: hist });
  const pending = parameterValue({ value: p.value === null ? null : Number(p.value), text_value: p.text_value, unit: p.unit });
  return <div className="space-y-2 p-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-medium">{p.name}</span>
      <span className={pending === 'Pendente' ? 'text-sm font-medium text-muted-foreground' : 'text-sm font-semibold'}>{pending}</span></div>
    <p className="text-xs text-muted-foreground">{p.origin ? VALUE_ORIGIN[p.origin] : 'Origem não informada'} · versão {p.version} · {fmtDateTime(p.updated_at)} · {names.get(p.updated_by) ?? '—'}{p.note ? ` · ${p.note}` : ''}</p>
    <div className="flex gap-3 text-xs"><button className="underline" onClick={() => setHist(!hist)}>Versões anteriores</button>{edit && <button className="underline" onClick={() => setEditing(!editing)}>Atualizar valor</button>}</div>
    {hist && <ul className="text-xs text-muted-foreground">{history.length === 0 && <li>Sem versões anteriores.</li>}{history.map(h => <li key={h.id}>v{h.version}: {h.old_value ?? 'Pendente'} → {h.new_value ?? 'Pendente'} ({fmtDateTime(h.changed_at)}, {names.get(h.changed_by) ?? '—'})</li>)}</ul>}
    {editing && <form className="grid gap-2 sm:grid-cols-4" onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); try { await save.mutateAsync(() => supabase.from('aircraft_parameters').update({ value: numberOrNull(f.get('value')), text_value: blank(f.get('text_value')), origin: blank(f.get('origin')), note: blank(f.get('note')) }).eq('id', p.id)); setEditing(false); } catch { /* exibido */ } }}>
      <Field label="Valor" name="value" defaultValue={p.value} /><Field label="Valor textual" name="text_value" defaultValue={p.text_value} />
      <Pick label="Origem" name="origin" options={Object.entries(VALUE_ORIGIN)} defaultValue={p.origin} /><Field label="Observação" name="note" defaultValue={p.note} />
      <button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground sm:col-span-4 sm:w-fit" disabled={save.isPending}>Salvar nova versão</button>
    </form>}
  </div>;
}
