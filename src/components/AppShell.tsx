import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Home, Users, User, Shield, LogOut, Plane, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { ROLE_LABEL } from "@/lib/format";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/integrantes", label: "Integrantes", icon: Users },
  { to: "/perfil", label: "Meu perfil", icon: User },
] as const;

export function AppShell() {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  if (!me || !me.active) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold">Conta inativa</h1>
        <p className="max-w-sm text-sm text-muted-foreground">Sua conta foi desativada ou ainda não foi liberada. Fale com o capitão da equipe.</p>
        <Button variant="outline" onClick={signOut}>Sair</Button>
      </div>
    );
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}>
          <Icon className="h-4 w-4" /> {label}
        </Link>
      ))}
      {me.isAdmin && (
        <Link to="/admin" onClick={() => setOpen(false)}
          className="mt-4 flex items-center gap-3 rounded-lg border border-sidebar-border px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}>
          <Shield className="h-4 w-4 text-sidebar-primary" /> Painel de administração
        </Link>
      )}
    </nav>
  );

  const footer = (
    <div className="border-t border-sidebar-border pt-4">
      <p className="truncate text-sm font-medium text-sidebar-foreground">{me.full_name || me.email}</p>
      <p className="truncate text-xs text-sidebar-foreground/60">{ROLE_LABEL[me.role]} · {me.sector_name}</p>
      <button onClick={signOut} className="mt-3 flex items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground">
        <LogOut className="h-3.5 w-3.5" /> Sair
      </button>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col gap-6 bg-sidebar p-5 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="flex items-center gap-2 font-display font-semibold text-sidebar-foreground"><Plane className="h-5 w-5 text-sidebar-primary" /> Aerodesign</div>
        {nav}
        {footer}
      </aside>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2 font-display font-semibold text-sidebar-foreground"><Plane className="h-5 w-5 text-sidebar-primary" /> Aerodesign</div>
        <button aria-label="Menu" onClick={() => setOpen(!open)} className="text-sidebar-foreground">{open ? <X /> : <Menu />}</button>
      </header>
      {open && (
        <div className="fixed inset-x-0 top-[52px] bottom-0 z-20 flex flex-col gap-6 bg-sidebar p-5 lg:hidden">{nav}{footer}</div>
      )}
      <main className="flex-1 px-4 py-6 sm:px-8 lg:py-10"><div className="mx-auto max-w-5xl"><Outlet /></div></main>
    </div>
  );
}
