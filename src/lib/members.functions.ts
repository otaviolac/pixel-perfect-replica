import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleEnum = z.enum(["trainee", "membro", "gerente", "capitao"]);

/** Verifica se o chamador pode gerir integrantes no contexto pedido. */
async function authorize(supabase: any, userId: string, via: "operacional" | "admin") {
  const fn = via === "admin" ? "is_admin" : "is_captain";
  const { data, error } = await supabase.rpc(fn, { _uid: userId });
  if (error || !data) throw new Error("Você não tem permissão para esta ação.");
}

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      email: z.string().trim().email("E-mail inválido").max(255),
      full_name: z.string().trim().min(2, "Informe o nome").max(120),
      role: roleEnum,
      sector_id: z.number().int().min(1).max(8),
      via: z.enum(["operacional", "admin"]),
      redirectTo: z.string().url(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await authorize(context.supabase, context.userId, data.via);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.role === "gerente") {
      const { data: g } = await supabaseAdmin.from("memberships").select("user_id").eq("sector_id", data.sector_id).eq("role", "gerente");
      if (g && g.length) throw new Error("Este setor já possui um gerente ativo.");
    }
    const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    if (error || !inv.user) throw new Error(error?.message.includes("already") ? "Este e-mail já está cadastrado." : "Não foi possível enviar o convite.");
    const uid = inv.user.id;
    await supabaseAdmin.from("profiles").update({ full_name: data.full_name }).eq("id", uid);
    const { error: mErr } = await supabaseAdmin.from("memberships").update({ role: data.role, sector_id: data.sector_id, updated_by: context.userId }).eq("user_id", uid);
    if (mErr) throw new Error("Convite enviado, mas não foi possível definir cargo/setor.");
    await supabaseAdmin.from("role_change_history").insert({ user_id: uid, new_role: data.role, new_sector: data.sector_id, changed_by: context.userId, via_admin: data.via === "admin" });
    await supabaseAdmin.from("audit_log").insert({ actor_id: context.userId, area: data.via, action: "convite_integrante", entity: "profiles", entity_id: uid, details: { email: data.email, role: data.role, sector_id: data.sector_id } });
    return { ok: true };
  });

export const updateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      user_id: z.string().uuid(),
      role: roleEnum,
      sector_id: z.number().int().min(1).max(8),
      active: z.boolean(),
      via: z.enum(["operacional", "admin"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await authorize(context.supabase, context.userId, data.via);
    if (data.user_id === context.userId && (!data.active || data.role !== "capitao") && data.via === "operacional") {
      throw new Error("Você não pode rebaixar ou desativar a própria conta por aqui.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin.from("memberships").select("role, sector_id").eq("user_id", data.user_id).single();
    if (!cur) throw new Error("Integrante não encontrado.");
    if (data.role === "gerente") {
      const { data: g } = await supabaseAdmin.from("memberships").select("user_id").eq("sector_id", data.sector_id).eq("role", "gerente").neq("user_id", data.user_id);
      if (g && g.length) throw new Error("Este setor já possui um gerente ativo.");
    }
    const { error } = await supabaseAdmin.from("memberships").update({ role: data.role, sector_id: data.sector_id, updated_by: context.userId, updated_at: new Date().toISOString() }).eq("user_id", data.user_id);
    if (error) throw new Error("Não foi possível salvar.");
    await supabaseAdmin.from("profiles").update({ active: data.active }).eq("id", data.user_id);
    if (cur.role !== data.role || cur.sector_id !== data.sector_id) {
      await supabaseAdmin.from("role_change_history").insert({ user_id: data.user_id, old_role: cur.role, new_role: data.role, old_sector: cur.sector_id, new_sector: data.sector_id, changed_by: context.userId, via_admin: data.via === "admin" });
    }
    await supabaseAdmin.from("audit_log").insert({ actor_id: context.userId, area: data.via, action: "alteracao_integrante", entity: "memberships", entity_id: data.user_id, details: { de: cur, para: { role: data.role, sector_id: data.sector_id, active: data.active } } });
    return { ok: true };
  });

export const setFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: z.string().max(40), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await authorize(context.supabase, context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("feature_flags").update({ enabled: data.enabled, updated_by: context.userId, updated_at: new Date().toISOString() }).eq("key", data.key);
    await supabaseAdmin.from("audit_log").insert({ actor_id: context.userId, area: "admin", action: data.enabled ? "modulo_ativado" : "modulo_desativado", entity: "feature_flags", entity_id: data.key });
    return { ok: true };
  });

export const setTeamName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ team_name: z.string().trim().min(2).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    await authorize(context.supabase, context.userId, "admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("team_settings").update({ team_name: data.team_name, updated_at: new Date().toISOString() }).eq("id", true);
    await supabaseAdmin.from("audit_log").insert({ actor_id: context.userId, area: "admin", action: "nome_equipe", details: data });
    return { ok: true };
  });
