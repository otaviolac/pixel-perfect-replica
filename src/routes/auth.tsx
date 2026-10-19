import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthFrame } from "@/components/AuthFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — App Aerodesign" },
      { name: "description", content: "Acesso dos integrantes da equipe de Aerodesign." },
      { property: "og:title", content: "Entrar — App Aerodesign" },
      { property: "og:description", content: "Acesso dos integrantes da equipe de Aerodesign." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error("E-mail ou senha incorretos."); return; }
    navigate({ to: "/inicio" });
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    toast.success("Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
    setMode("login");
  }

  if (mode === "forgot") {
    return (
      <AuthFrame title="Recuperar senha" subtitle="Enviaremos um link para o seu e-mail.">
        <form onSubmit={onForgot} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button className="w-full" disabled={busy}>Enviar link</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("login")}>Voltar</Button>
        </form>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Entrar" subtitle="Use o e-mail do seu convite.">
      <form onSubmit={onLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button className="w-full" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</Button>
        <button type="button" onClick={() => setMode("forgot")} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
          Esqueci minha senha
        </button>
      </form>
      <p className="mt-8 text-xs text-muted-foreground">Não há cadastro público. Solicite um convite ao capitão da equipe.</p>
    </AuthFrame>
  );
}
