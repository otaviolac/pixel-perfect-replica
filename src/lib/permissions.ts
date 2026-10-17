export type Role = "trainee" | "membro" | "gerente" | "capitao";

/** Quem pode gerenciar integrantes na área operacional. Admin só no painel /admin. */
export function canManageMembersOperational(role: Role | null | undefined) {
  return role === "capitao";
}

export function canEditCompetition(role: Role | null | undefined) {
  return role === "capitao";
}

/** Valida uma mudança de cargo/setor: no máximo um gerente ativo por setor. */
export function managerConflict(
  members: { user_id: string; role: Role; sector_id: number; active: boolean }[],
  target: { user_id: string; role: Role; sector_id: number },
) {
  if (target.role !== "gerente") return false;
  return members.some(
    (m) => m.user_id !== target.user_id && m.active && m.role === "gerente" && m.sector_id === target.sector_id,
  );
}
