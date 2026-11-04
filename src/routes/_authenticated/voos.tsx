import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { NotebookPen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { flightsQuery, aircraftQuery, useTechSave, blank } from '@/lib/technical';
import { managesSector } from '@/lib/technical-rules';
import { meQuery, membersQuery, sectorsQuery } from '@/lib/me';
import { pageHead, fmtDateTime, spLocalToISO } from '@/lib/format';
import { Field, Pick, FormToggle, Empty, Info, TechHistory } from '@/components/TechUI';

export const Route = createFileRoute('/_authenticated/voos')({
  head: () => pageHead('Diário de Voo', 'Registro independente dos voos realizados pela equipe Aerodesign.'),
  loader: ({ context }) => Promise.all([flightsQuery, aircraftQuery, meQuery, membersQuery, sectorsQuery].map(q => context.queryClient.ensureQueryData(q as never))),
  component: FlightsPage,
});

function FlightsPage() {
  const { data } = useSuspenseQuery(flightsQuery); const { data: ac } = useSuspenseQuery(aircraftQuery);
  const { data: me } = useSuspenseQuery(meQuery); const { data: members } = useSuspenseQuery(membersQuery); const { data: sectors } = useSuspenseQuery(sectorsQuery);
  const names = new Map(members.map(m => [m.id, m.full_name || m.email])); const save = useTechSave();
  const canCreate = me?.role === 'capitao' || me?.role === 'gerente';
  const sectorOpts: [string, string][] = sectors.filter(s => managesSector(me, s.id)).map(s => [String(s.id), s.name]);
  return <div className="space-y-6">
    <h1 className="flex items-center gap-2 text-2xl font-semibold"><NotebookPen className="h-6 w-6" />Diário de Voo</h1>
    <p className="text-sm text-muted-foreground">Registro de voos, separado dos testes e ensaios. A gerência responsável e o capitão registram; participantes adicionam observações.</p>
    {canCreate && <FormToggle label="Registrar voo" pending={save.isPending} onSubmit={f => save.mutateAsync(() => supabase.from('flights').insert({
      sector_id: Number(f.get('sector_id')), aircraft_id: blank(f.get('aircraft_id')), flown_at: spLocalToISO(String(f.get('flown_at'))), location: String(f.get('location')), pilot: String(f.get('pilot')),
      objective: String(f.get('objective')), configuration: blank(f.get('configuration')), duration_min: blank(f.get('duration_min')) ? Number(String(f.get('duration_min')).replace(',', '.')) : null,
      weather: blank(f.get('weather')), results: blank(f.get('results')), incidents: blank(f.get('incidents')), observations: blank(f.get('observations')), created_by: me!.id }))}>
      <Pick label="Setor responsável" name="sector_id" required options={sectorOpts} defaultValue={me?.sector_id} />
      <Pick label="Aeronave" name="aircraft_id" options={ac.aircraft.map(a => [a.id, a.name])} />
      <Field label="Data e hora" name="flown_at" type="datetime-local" required /><Field label="Local" name="location" required />
      <Field label="Piloto" name="pilot" required /><Field label="Duração (min)" name="duration_min" />
      <Field label="Objetivo" name="objective" required area /><Field label="Configuração" name="configuration" area />
      <Field label="Condições do tempo" name="weather" /><Field label="Resultados" name="results" area />
      <Field label="Incidentes" name="incidents" area /><Field label="Observações" name="observations" area />
    </FormToggle>}
    {data.flights.length === 0 && <Empty>Nenhum voo registrado.</Empty>}
    <div className="space-y-3">{data.flights.map(fl => {
      const notes = data.notes.filter(n => n.flight_id === fl.id); const contrib = data.contributors.filter(c => c.flight_id === fl.id);
      const manage = managesSector(me, fl.sector_id); const canNote = manage || contrib.some(c => c.user_id === me?.id);
      return <article key={fl.id} className="space-y-2 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">{fmtDateTime(fl.flown_at)} · {fl.location}</h2><span className="text-xs text-muted-foreground">{sectors.find(s => s.id === fl.sector_id)?.name}</span></div>
        <Info label="Aeronave" value={ac.aircraft.find(a => a.id === fl.aircraft_id)?.name} /><Info label="Piloto" value={fl.pilot} /><Info label="Objetivo" value={fl.objective} />
        <Info label="Duração" value={fl.duration_min ? `${fl.duration_min} min` : null} /><Info label="Configuração" value={fl.configuration} /><Info label="Tempo" value={fl.weather} />
        <Info label="Resultados" value={fl.results} /><Info label="Incidentes" value={fl.incidents} /><Info label="Observações" value={fl.observations} />
        <Info label="Participantes" value={contrib.map(c => names.get(c.user_id)).join(', ')} />
        {manage && <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); const u = String(new FormData(e.currentTarget).get('user')); if (u) save.mutate(() => supabase.from('flight_contributors').insert({ flight_id: fl.id, user_id: u, added_by: me!.id })); }}>
          <select name="user" aria-label="Adicionar participante" className="rounded-md border bg-background px-2 py-1 text-sm"><option value="">Adicionar participante…</option>{members.filter(m => m.active && !contrib.some(c => c.user_id === m.id)).map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}</select>
          <button className="text-sm underline">Adicionar</button></form>}
        {notes.length > 0 && <ul className="space-y-1 border-l-2 pl-3 text-sm">{notes.map(n => <li key={n.id}>{n.body} <span className="text-xs text-muted-foreground">— {names.get(n.author_id)}, {fmtDateTime(n.created_at)}</span></li>)}</ul>}
        {canNote && <form className="flex gap-2" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const b = blank(new FormData(form).get('body')); if (b) save.mutate(() => supabase.from('flight_notes').insert({ flight_id: fl.id, body: b, author_id: me!.id }), { onSuccess: () => form.reset() }); }}>
          <input name="body" placeholder="Nova observação" className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm" /><button className="text-sm underline">Enviar</button></form>}
        {manage && <button className="text-xs text-muted-foreground underline" onClick={() => confirm('Arquivar este voo?') && save.mutate(() => supabase.from('flights').update({ archived_at: new Date().toISOString() }).eq('id', fl.id))}>Arquivar</button>}
        <TechHistory kind="flight" id={fl.id} names={names} />
      </article>;
    })}</div>
  </div>;
}
