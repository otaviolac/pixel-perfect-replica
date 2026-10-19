import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Timer, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { countdown, fmtDateTime, isoToSpLocal, spLocalToISO } from "@/lib/format";
import { canEditCompetition } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { tasksQuery, flagsQuery, notificationsQuery, pageHead } from '@/lib/tasks';
import { TASK_STATUS, type TaskStatus, deadlineState } from '@/lib/task-rules';
import { agendaQuery } from '@/lib/agenda';
import { EVENT_STATUS } from '@/lib/agenda-rules';

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => pageHead('Início', 'Tarefas, prazos e avisos do integrante da equipe Aerodesign.'),
  component: Inicio,
});

function useCompetition() {
  return useQuery({
    queryKey: ["competition"],
    queryFn: async () =>
      (await supabase.from("competition_dates").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle()).data,
  });
}

function Inicio() {
  const { data: me } = useMe();
  const { data: comp } = useCompetition();
  const { data: tasks = [] } = useQuery(tasksQuery);
  const { data: flags = [] } = useQuery(flagsQuery);
  const { data: notices = [] } = useQuery(notificationsQuery);
  const { data: calendar } = useQuery(agendaQuery);
  const { data: assignments = [] } = useQuery({ queryKey: ['my-assignments', me?.id], enabled: !!me, queryFn: async () => { if (!me) return []; const r = await supabase.from('task_participants').select('task_id').eq('user_id', me.id); return r.data ?? []; } });
  const relevant = tasks.filter(t => flags.some(f => f.key === (t.kind === 'official' ? 'tarefas' : 'voluntarias') && f.enabled) && !['completed','cancelled'].includes(t.status) && (t.owner_id === me?.id || assignments.some(a => a.task_id === t.id) || (t.whole_sector && t.sector_id === me?.sector_id))).sort((a,b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'));
  const [now, setNow] = useState(Date.now());
  const [edit, setEdit] = useState(false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const cd = comp ? countdown(comp.starts_at, now) : null;
  const upcoming = (calendar?.events ?? []).filter(e => flags.some(f => f.key === 'agenda' && f.enabled) && (e.kind !== 'meeting' || flags.some(f => f.key === 'reunioes' && f.enabled)) && !e.archived_at && ['pending','scheduled'].includes(e.status) && new Date(e.ends_at).getTime() >= now && (e.organizer_id === me?.id || e.created_by === me?.id || calendar?.invitees.some(i => i.event_id === e.id && i.user_id === me?.id))).slice(0,5);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Olá,</p>
        <h1 className="text-3xl font-semibold">{me?.full_name || me?.email}</h1>
      </div>

      <section className="relative overflow-hidden rounded-2xl bg-sky p-6 text-sidebar-foreground sm:p-8">
        <div className="grid-lines absolute inset-0" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-sidebar-foreground/60"><Timer className="h-3.5 w-3.5" /> Próxima competição</p>
            <h2 className="mt-2 text-xl font-semibold">{comp?.name ?? "Data ainda não cadastrada"}</h2>
            {comp && <p className="text-sm text-sidebar-foreground/70">{fmtDateTime(comp.starts_at)}{comp.location ? ` · ${comp.location}` : ""}</p>}
          </div>
          {canEditCompetition(me?.role) && (
            <Button size="sm" variant="secondary" onClick={() => setEdit(true)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
          )}
        </div>
        {comp && (
          <div className="relative mt-6 flex gap-6">
            {cd ? (
              [["dias", cd.days], ["horas", cd.hours], ["min", cd.minutes]].map(([l, v]) => (
                <div key={l as string}><div className="font-display text-4xl font-semibold text-sidebar-primary sm:text-5xl">{v}</div><div className="text-xs text-sidebar-foreground/60">{l}</div></div>
              ))
            ) : (
              <p className="text-sm">A data cadastrada já passou. O capitão pode informar a próxima.</p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Minhas tarefas e prazos</h2><Link to="/tarefas" className="text-sm underline">Ver tarefas</Link></div>
        {!relevant.length && <p className="border-y py-6 text-sm text-muted-foreground">Nenhuma tarefa em aberto para você.</p>}
        {relevant.slice(0,5).map(t => <Link key={t.id} to="/tarefas/$taskId" params={{taskId:t.id}} className="block border-b py-3"><h3 className="break-words text-sm font-medium">{t.title}</h3><p className={`mt-1 text-xs ${deadlineState(t.due_at,t.status,now)==='overdue'?'text-destructive':'text-muted-foreground'}`}>{TASK_STATUS[t.status as TaskStatus]} · {t.due_at ? fmtDateTime(t.due_at) : 'Sem prazo'}{deadlineState(t.due_at,t.status,now)==='overdue' && ' · Atrasada'}</p></Link>)}
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Próximos eventos e reuniões</h2><Link to="/agenda" className="shrink-0 text-sm underline">Ver agenda</Link></div>
        {!upcoming.length && <p className="border-y py-6 text-sm text-muted-foreground">Nenhum evento previsto para você.</p>}
        {upcoming.map(e => <Link key={e.id} to="/agenda/$eventId" params={{eventId:e.id}} className="block border-b py-3"><h3 className="break-words text-sm font-medium">{e.title}</h3><p className="mt-1 break-words text-xs text-muted-foreground">{fmtDateTime(e.starts_at)} · {e.location} · {EVENT_STATUS[e.status]}</p></Link>)}
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Avisos recentes</h2><Link to="/notificacoes" className="text-sm underline">Ver notificações</Link></div>
        {!notices.length && <p className="border-y py-6 text-sm text-muted-foreground">Nenhum aviso recente.</p>}
        {notices.slice(0,3).map(n => <p key={n.id} className="border-b py-3 text-sm">{n.title}</p>)}
      </section>

      {edit && <CompetitionDialog current={comp ?? null} onClose={() => setEdit(false)} />}
    </div>
  );
}

function CompetitionDialog({ current, onClose }: { current: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(current?.name ?? "");
  const [when, setWhen] = useState(current ? isoToSpLocal(current.starts_at) : "");
  const [location, setLocation] = useState(current?.location ?? "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !when) { toast.error("Informe nome e data/hora."); return; }
    const { data: u } = await supabase.auth.getUser();
    if (current) await supabase.from("competition_dates").update({ archived_at: new Date().toISOString() }).eq("id", current.id);
    const { error } = await supabase.from("competition_dates").insert({ name: name.trim(), starts_at: spLocalToISO(when), location: location.trim() || null, created_by: u.user?.id ?? null });
    if (error) { toast.error("Não foi possível salvar."); return; }
    toast.success("Competição atualizada.");
    qc.invalidateQueries({ queryKey: ["competition"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Próxima competição</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2"><Label>Nome do evento</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
          <div className="space-y-2"><Label>Data e hora (horário de Brasília)</Label><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
          <div className="space-y-2"><Label>Local (opcional)</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} /></div>
          <Button className="w-full">Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
