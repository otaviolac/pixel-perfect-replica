import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { setFeatureFlag, setTeamName } from "@/lib/members.functions";
import { fmtDateTime } from "@/lib/format";
import { MembersManager } from "@/components/MembersManager";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administração — App Aerodesign" }, { name: "description", content: "Painel técnico de administração." }] }),
  component: Admin,
});

function Admin() {
  const { data: me } = useMe();
  if (!me?.isAdmin) return (
    <div className="space-y-2"><h1 className="text-2xl font-semibold">Acesso restrito</h1><p className="text-sm text-muted-foreground">Esta área é exclusiva da administração técnica.</p><Link to="/inicio" className="text-sm underline">Voltar</Link></div>
  );
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-semibold">Painel de administração</h1><p className="text-sm text-muted-foreground">Ações técnicas registradas em trilha própria. Não concede poderes operacionais.</p></div>
      <Tabs defaultValue="integrantes">
        <TabsList><TabsTrigger value="integrantes">Contas</TabsTrigger><TabsTrigger value="modulos">Módulos</TabsTrigger><TabsTrigger value="equipe">Equipe</TabsTrigger><TabsTrigger value="log">Auditoria</TabsTrigger></TabsList>
        <TabsContent value="integrantes" className="mt-4"><MembersManager canManage via="admin" /></TabsContent>
        <TabsContent value="modulos" className="mt-4"><Flags /></TabsContent>
        <TabsContent value="equipe" className="mt-4"><Team /></TabsContent>
        <TabsContent value="log" className="mt-4"><Audit /></TabsContent>
      </Tabs>
    </div>
  );
}

function Flags() {
  const qc = useQueryClient();
  const fn = useServerFn(setFeatureFlag);
  const { data = [] } = useQuery({ queryKey: ["flags"], queryFn: async () => (await supabase.from("feature_flags").select("*").order("label")).data ?? [] });
  return (
    <div className="rounded-2xl border bg-card">
      <p className="border-b px-5 py-3 text-sm text-muted-foreground">Desativar um módulo apenas o oculta; os dados históricos são preservados.</p>
      <ul className="divide-y">{data.map((f) => (
        <li key={f.key} className="flex items-center justify-between px-5 py-3 text-sm">{f.label}
          <Switch checked={f.enabled} onCheckedChange={async (v) => { try { await fn({ data: { key: f.key, enabled: v } }); qc.invalidateQueries({ queryKey: ["flags"] }); } catch (e: any) { toast.error(e.message); } }} />
        </li>))}</ul>
    </div>
  );
}

function Team() {
  const fn = useServerFn(setTeamName);
  const { data } = useQuery({ queryKey: ["team"], queryFn: async () => (await supabase.from("team_settings").select("*").single()).data });
  const [name, setName] = useState("");
  useEffect(() => { if (data) setName(data.team_name); }, [data]);
  return (
    <form className="flex max-w-md gap-2" onSubmit={async (e) => { e.preventDefault(); try { await fn({ data: { team_name: name } }); toast.success("Salvo."); } catch (err: any) { toast.error(err.message); } }}>
      <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /><Button>Salvar</Button>
    </form>
  );
}

function Audit() {
  const { data = [] } = useQuery({ queryKey: ["audit"], queryFn: async () => (await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [] });
  if (!data.length) return <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>;
  return (
    <ul className="divide-y rounded-2xl border bg-card text-sm">{data.map((a) => (
      <li key={a.id} className="flex flex-wrap justify-between gap-2 px-5 py-2"><span><b className="font-medium">{a.action}</b> <span className="text-muted-foreground">({a.area})</span></span><span className="text-muted-foreground">{fmtDateTime(a.created_at)}</span></li>
    ))}</ul>
  );
}
