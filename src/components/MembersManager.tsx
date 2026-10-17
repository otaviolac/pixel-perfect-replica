import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { membersQuery, sectorsQuery } from "@/lib/me";
import { inviteMember, updateMember } from "@/lib/members.functions";
import { ROLE_LABEL } from "@/lib/format";
import type { Role } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ROLES: Role[] = ["trainee", "membro", "gerente", "capitao"];

export function MembersManager({ canManage, via }: { canManage: boolean; via: "operacional" | "admin" }) {
  const { data: members = [] } = useQuery(membersQuery);
  const { data: sectors = [] } = useQuery(sectorsQuery);
  const [invite, setInvite] = useState(false);
  const [editing, setEditing] = useState<(typeof members)[number] | null>(null);
  const sectorName = (id: number) => sectors.find((s) => s.id === id)?.name ?? "";

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end"><Button onClick={() => setInvite(true)}><UserPlus className="h-4 w-4" /> Convidar integrante</Button></div>
      )}
      {sectors.map((s) => {
        const list = members.filter((m) => m.sector_id === s.id);
        return (
          <section key={s.id} className="rounded-2xl border bg-card">
            <header className="flex items-center justify-between border-b px-5 py-3">
              <h3 className="font-semibold">{s.name}</h3>
              <span className="text-xs text-muted-foreground">{list.length} integrante(s)</span>
            </header>
            {list.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">Nenhum integrante cadastrado.</p>
            ) : (
              <ul className="divide-y">
                {list.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.full_name || m.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!m.active && <Badge variant="destructive">Inativo</Badge>}
                      <Badge variant={m.role === "gerente" || m.role === "capitao" ? "default" : "secondary"}>{ROLE_LABEL[m.role]}</Badge>
                      {canManage && <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>Editar</Button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {invite && <InviteDialog via={via} sectors={sectors} onClose={() => setInvite(false)} />}
      {editing && <EditDialog via={via} sectors={sectors} member={editing} sectorName={sectorName} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RoleSector({ role, setRole, sector, setSector, sectors }: any) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2"><Label>Cargo</Label>
        <Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="space-y-2"><Label>Setor</Label>
        <Select value={String(sector)} onValueChange={(v) => setSector(Number(v))}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{sectors.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select>
      </div>
    </div>
  );
}

function InviteDialog({ via, sectors, onClose }: any) {
  const qc = useQueryClient();
  const fn = useServerFn(inviteMember);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("trainee");
  const [sector, setSector] = useState(1);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fn({ data: { email, full_name: name, role, sector_id: sector, via, redirectTo: `${window.location.origin}/reset-password` } });
      toast.success("Convite enviado por e-mail.");
      qc.invalidateQueries({ queryKey: ["members"] });
      onClose();
    } catch (err: any) { toast.error(err.message ?? "Erro ao convidar."); }
    setBusy(false);
  }
  return (
    <Dialog open onOpenChange={onClose}><DialogContent>
      <DialogHeader><DialogTitle>Convidar integrante</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label>Nome completo</Label><Input required value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
        <div className="space-y-2"><Label>E-mail</Label><Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <RoleSector role={role} setRole={setRole} sector={sector} setSector={setSector} sectors={sectors} />
        <Button className="w-full" disabled={busy}>{busy ? "Enviando…" : "Enviar convite"}</Button>
      </form>
    </DialogContent></Dialog>
  );
}

function EditDialog({ via, sectors, member, onClose }: any) {
  const qc = useQueryClient();
  const fn = useServerFn(updateMember);
  const [role, setRole] = useState<Role>(member.role);
  const [sector, setSector] = useState<number>(member.sector_id);
  const [active, setActive] = useState<boolean>(member.active);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await fn({ data: { user_id: member.id, role, sector_id: sector, active, via } });
      toast.success("Integrante atualizado.");
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      onClose();
    } catch (err: any) { toast.error(err.message ?? "Erro ao salvar."); }
  }
  return (
    <Dialog open onOpenChange={onClose}><DialogContent>
      <DialogHeader><DialogTitle>{member.full_name || member.email}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <RoleSector role={role} setRole={setRole} sector={sector} setSector={setSector} sectors={sectors} />
        <div className="flex items-center justify-between rounded-lg border p-3"><Label>Conta ativa</Label><Switch checked={active} onCheckedChange={setActive} /></div>
        <Button className="w-full">Salvar</Button>
      </form>
    </DialogContent></Dialog>
  );
}
