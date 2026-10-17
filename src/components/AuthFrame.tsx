import type { ReactNode } from "react";
import { Plane } from "lucide-react";

export function AuthFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-sky text-sidebar-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="grid-lines absolute inset-0" />
        <div className="relative flex items-center gap-2 font-display text-lg font-semibold">
          <Plane className="h-5 w-5 text-accent" /> App Aerodesign
        </div>
        <div className="relative max-w-md">
          <p className="font-display text-4xl font-semibold leading-tight">Organização da equipe, do projeto ao voo.</p>
          <p className="mt-4 text-sidebar-foreground/70">Acesso restrito a integrantes convidados.</p>
        </div>
        <div className="relative text-xs text-sidebar-foreground/50">America/Sao_Paulo</div>
      </div>
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 font-display font-semibold lg:hidden">
            <Plane className="h-5 w-5 text-accent" /> App Aerodesign
          </div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
