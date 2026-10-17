import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({ meta: [{ title: "Início — App Aerodesign" }, { name: "description", content: "Resumo do integrante." }] }),
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
  const [now, setNow] = useState(Date.now());
  const [edit, setEdit] = useState(false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const cd = comp ? countdown(comp.starts_at, now) : null;

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

      <section className="rounded-2xl border bg-card p-6">
        <h3 className="font-semibold">Seus módulos</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Tarefas, agenda, testes e demais módulos estão em construção e aparecerão aqui assim que estiverem prontos. Nenhum dado fictício é exibido.
        </p>
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
    if (!name.trim() || !when) return toast.error("Informe nome e data/hora.");
    const { data: u } = await supabase.auth.getUser();
    if (current) await supabase.from("competition_dates").update({ archived_at: new Date().toISOString() }).eq("id", current.id);
    const { error } = await supabase.from("competition_dates").insert({ name: name.trim(), starts_at: spLocalToISO(when), location: location.trim() || null, created_by: u.user?.id });
    if (error) return toast.error("Não foi possível salvar.");
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
