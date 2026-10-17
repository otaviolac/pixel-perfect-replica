import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { avatarUrl, useMe } from "@/lib/me";
import { ROLE_LABEL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — App Aerodesign" }, { name: "description", content: "Seus dados de integrante." }] }),
  component: Perfil,
});

function Perfil() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: "", birth_date: "", joined_at: "", phone: "", course: "" });
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    setForm({ full_name: me.full_name, birth_date: me.birth_date ?? "", joined_at: me.joined_at ?? "", phone: me.phone ?? "", course: me.course ?? "" });
    avatarUrl(me.photo_path).then(setPhoto);
  }, [me]);
  if (!me) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (form.full_name.trim().length < 2) { toast.error("Informe seu nome."); return; }
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name.trim().slice(0, 120),
      birth_date: form.birth_date || null, joined_at: form.joined_at || null,
      phone: form.phone.trim() || null, course: form.course.trim() || null,
    }).eq("id", me!.id);
    if (error) { toast.error("Não foi possível salvar."); return; }
    toast.success("Perfil atualizado.");
    qc.invalidateQueries({ queryKey: ["me"] });
  }

  async function upload(f: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) { toast.error("Use JPG, PNG ou WEBP."); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Máximo de 5 MB."); return; }
    const path = `${me!.id}/foto-${Date.now()}.${f.type.split("/")[1]}`;
    const { error } = await supabase.storage.from("avatars").upload(path, f, { upsert: true, contentType: f.type });
    if (error) { toast.error("Falha no envio da foto."); return; }
    await supabase.from("profiles").update({ photo_path: path }).eq("id", me!.id);
    qc.invalidateQueries({ queryKey: ["me"] });
    toast.success("Foto atualizada.");
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Meu perfil</h1>
      <div className="flex items-center gap-4 rounded-2xl border bg-card p-5">
        <div className="h-20 w-20 overflow-hidden rounded-full bg-muted">
          {photo ? <img src={photo} alt="Foto do integrante" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem foto</div>}
        </div>
        <div className="space-y-1">
          <p className="font-medium">{ROLE_LABEL[me.role]} · {me.sector_name}</p>
          <p className="text-xs text-muted-foreground">{me.email}</p>
          <label className="inline-block cursor-pointer text-sm text-accent-foreground underline">
            Enviar foto oficial
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        </div>
      </div>
      <form onSubmit={save} className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2"><Label>Nome completo</Label><Input value={form.full_name} onChange={set("full_name")} /></div>
        <div className="space-y-2"><Label>Data de nascimento</Label><Input type="date" value={form.birth_date} onChange={set("birth_date")} /></div>
        <div className="space-y-2"><Label>Data de ingresso na equipe</Label><Input type="date" value={form.joined_at} onChange={set("joined_at")} /></div>
        <div className="space-y-2"><Label>Telefone (opcional)</Label><Input value={form.phone} onChange={set("phone")} maxLength={30} /></div>
        <div className="space-y-2"><Label>Curso (opcional)</Label><Input value={form.course} onChange={set("course")} maxLength={80} /></div>
        <p className="text-xs text-muted-foreground sm:col-span-2">Cargo e setor só podem ser alterados pelo capitão.</p>
        <div className="sm:col-span-2"><Button>Salvar</Button></div>
      </form>
    </div>
  );
}
