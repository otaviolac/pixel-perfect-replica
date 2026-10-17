import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthFrame } from "@/components/AuthFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Definir senha — App Aerodesign" },
      { name: "description", content: "Defina sua senha de acesso." },
      { property: "og:title", content: "Definir senha — App Aerodesign" },
      { property: "og:description", content: "Defina sua senha de acesso." },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { toast.error("A senha deve ter pelo menos 8 caracteres."); return; }
    if (pw !== pw2) { toast.error("As senhas não coincidem."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error("Link inválido ou expirado. Solicite um novo."); return; }
    toast.success("Senha definida.");
    navigate({ to: "/inicio" });
  }

  return (
    <AuthFrame title="Definir senha" subtitle="Use este formulário após abrir o link do convite ou da recuperação.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label>Nova senha</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required /></div>
        <div className="space-y-2"><Label>Confirmar senha</Label><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required /></div>
        <Button className="w-full" disabled={busy}>Salvar senha</Button>
      </form>
    </AuthFrame>
  );
}
