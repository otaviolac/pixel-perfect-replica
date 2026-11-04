import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { BookOpen, GraduationCap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { knowledgeQuery, trainingQuery, aircraftQuery, useTechSave, blank } from '@/lib/technical';
import { KNOWLEDGE_KIND, managesSector } from '@/lib/technical-rules';
import { meQuery, membersQuery, sectorsQuery } from '@/lib/me';
import { pageHead, fmtDate } from '@/lib/format';
import { Field, Pick, FormToggle, Empty, Info, TechHistory } from '@/components/TechUI';

export const Route = createFileRoute('/_authenticated/memoria')({
  head: () => pageHead('Memória técnica e formação', 'Decisões, soluções, aprendizados e materiais de formação da equipe.'),
  loader: ({ context }) => Promise.all([knowledgeQuery(''), trainingQuery, aircraftQuery, meQuery, membersQuery, sectorsQuery].map(q => context.queryClient.ensureQueryData(q as never))),
  component: MemoryPage,
});

function MemoryPage() {
  const { data: me } = useSuspenseQuery(meQuery); const { data: members } = useSuspenseQuery(membersQuery); const { data: sectors } = useSuspenseQuery(sectorsQuery);
  const { data: ac } = useSuspenseQuery(aircraftQuery); const { data: training } = useSuspenseQuery(trainingQuery);
  const [q, setQ] = useState(''); const [search, setSearch] = useState('');
  const { data: entries = [], isFetching } = useQuery(knowledgeQuery(search));
  const names = new Map(members.map(m => [m.id, m.full_name || m.email])); const save = useTechSave();
  const mine = sectors.filter(s => managesSector(me, s.id)).map(s => [String(s.id), s.name] as [string, string]);
  return <div className="space-y-8">
    <section className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><BookOpen className="h-6 w-6" />Memória técnica</h1>
      <p className="text-sm text-muted-foreground">A gerência do setor e o capitão registram; todos consultam.</p>
      <div className="flex flex-wrap gap-3">
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setSearch(q); }}><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar na memória" className="rounded-md border bg-background px-3 py-2 text-sm" /><button className="text-sm underline">Buscar</button></form>
        {mine.length > 0 && <FormToggle label="Novo registro" pending={save.isPending} onSubmit={f => save.mutateAsync(() => supabase.from('knowledge_entries').insert({
          title: String(f.get('title')), kind: String(f.get('kind')), sector_id: Number(f.get('sector_id')), subject: String(f.get('subject')), aircraft_id: blank(f.get('aircraft_id')),
          entry_date: String(f.get('entry_date')), body: String(f.get('body')), refs: blank(f.get('refs')), created_by: me!.id }))}>
          <Field label="Título" name="title" required /><Pick label="Tipo" name="kind" required options={Object.entries(KNOWLEDGE_KIND)} />
          <Pick label="Setor" name="sector_id" required options={mine} defaultValue={me?.sector_id} /><Field label="Assunto" name="subject" required />
          <Pick label="Aeronave" name="aircraft_id" options={ac.aircraft.map(a => [a.id, a.name])} /><Field label="Data" name="entry_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          <div className="sm:col-span-2"><Field label="Conteúdo" name="body" required area /></div><Field label="Referências" name="refs" />
        </FormToggle>}
      </div>
      {isFetching ? <p className="text-sm text-muted-foreground">Buscando…</p> : entries.length === 0 && <Empty>{search ? 'Nada encontrado.' : 'Nenhum registro na memória técnica.'}</Empty>}
      <div className="space-y-3">{entries.map(k => <article key={k.id} className="space-y-1 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">{k.title}</h2>
        <p className="text-xs text-muted-foreground">{KNOWLEDGE_KIND[k.kind]} · {sectors.find(s => s.id === k.sector_id)?.name} · {k.subject} · {fmtDate(k.entry_date)} · {names.get(k.created_by)}</p>
        <p className="whitespace-pre-wrap text-sm">{k.body}</p><Info label="Referências" value={k.refs} />
        {managesSector(me, k.sector_id) && <button className="text-xs text-muted-foreground underline" onClick={() => confirm('Arquivar este registro?') && save.mutate(() => supabase.from('knowledge_entries').update({ archived_at: new Date().toISOString() }).eq('id', k.id))}>Arquivar</button>}
        <TechHistory kind="knowledge" id={k.id} names={names} />
      </article>)}</div>
    </section>

    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><GraduationCap className="h-5 w-5" />Formação</h2>
      {mine.length > 0 && <FormToggle label="Novo material de formação" pending={save.isPending} onSubmit={f => save.mutateAsync(() => supabase.from('training_resources').insert({
        title: String(f.get('title')), sector_id: Number(f.get('sector_id')), description: blank(f.get('description')), link: blank(f.get('link')), criterion: blank(f.get('criterion')), qualification: blank(f.get('qualification')), created_by: me!.id }))}>
        <Field label="Título" name="title" required /><Pick label="Setor" name="sector_id" required options={mine} defaultValue={me?.sector_id} />
        <Field label="Link" name="link" type="url" /><Field label="Qualificação obtida" name="qualification" />
        <Field label="Critério de conclusão" name="criterion" area /><Field label="Descrição" name="description" area />
      </FormToggle>}
      {training.resources.length === 0 && <Empty>Nenhum material de formação.</Empty>}
      <div className="space-y-3">{training.resources.map(t => {
        const manage = managesSector(me, t.sector_id); const done = training.completions.filter(c => c.resource_id === t.id);
        return <article key={t.id} className="space-y-1 rounded-lg border bg-card p-4">
          <h3 className="font-semibold">{t.title}</h3><p className="text-xs text-muted-foreground">{sectors.find(s => s.id === t.sector_id)?.name}</p>
          <Info label="Descrição" value={t.description} /><Info label="Critério" value={t.criterion} /><Info label="Qualificação" value={t.qualification} />
          {t.link && /^https?:\/\//.test(t.link) && <a href={t.link} target="_blank" rel="noreferrer" className="text-sm underline">Abrir material</a>}
          {done.some(c => c.user_id === me?.id) && <p className="text-sm font-medium">Você concluiu esta formação.</p>}
          {manage && <>
            <Info label="Concluíram" value={done.map(c => `${names.get(c.user_id)} (${fmtDate(c.completed_on)})`).join(', ')} />
            <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const u = String(f.get('user')); if (u) save.mutate(() => supabase.from('training_completions').insert({ resource_id: t.id, user_id: u, completed_on: String(f.get('date')), recorded_by: me!.id })); }}>
              <select name="user" aria-label="Integrante" className="rounded-md border bg-background px-2 py-1 text-sm"><option value="">Registrar conclusão de…</option>{members.filter(m => m.active && !done.some(c => c.user_id === m.id)).map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}</select>
              <input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-md border bg-background px-2 py-1 text-sm" /><button className="text-sm underline">Registrar</button>
            </form></>}
        </article>;
      })}</div>
    </section>
  </div>;
}
