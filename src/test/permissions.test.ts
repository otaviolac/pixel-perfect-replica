import { describe, it, expect } from "vitest";
import { canManageMembersOperational, canEditCompetition, managerConflict } from "@/lib/permissions";

describe("regras de cargo", () => {
  it("só o capitão gerencia integrantes na área operacional", () => {
    expect(canManageMembersOperational("capitao")).toBe(true);
    expect(canManageMembersOperational("gerente")).toBe(false);
    expect(canManageMembersOperational("trainee")).toBe(false);
  });
  it("só o capitão altera a data da competição", () => {
    expect(canEditCompetition("capitao")).toBe(true);
    expect(canEditCompetition("gerente")).toBe(false);
  });
  it("no máximo um gerente ativo por setor", () => {
    const m = [{ user_id: "a", role: "gerente" as const, sector_id: 3, active: true }];
    expect(managerConflict(m, { user_id: "b", role: "gerente", sector_id: 3 })).toBe(true);
    expect(managerConflict(m, { user_id: "b", role: "gerente", sector_id: 4 })).toBe(false);
  });
});
