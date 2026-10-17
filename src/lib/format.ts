export const TZ = "America/Sao_Paulo";

export function fmtDate(v: string | Date | null | undefined) {
  if (!v) return "Pendente";
  const d = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + "T12:00:00Z") : new Date(v);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

export function fmtDateTime(v: string | Date | null | undefined) {
  if (!v) return "Pendente";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(v));
}

export function fmtBRL(n: number | null | undefined) {
  if (n == null) return "Pendente";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

/** Converte "yyyy-MM-ddTHH:mm" digitado em horário de Brasília para ISO UTC. */
export function spLocalToISO(local: string) {
  // Brasília não tem horário de verão desde 2019: UTC-3 fixo.
  return new Date(local + ":00-03:00").toISOString();
}

export function isoToSpLocal(iso: string) {
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000);
  return d.toISOString().slice(0, 16);
}

export function countdown(targetISO: string, now = Date.now()) {
  const ms = new Date(targetISO).getTime() - now;
  if (ms <= 0) return null;
  const m = Math.floor(ms / 60000);
  return { days: Math.floor(m / 1440), hours: Math.floor((m % 1440) / 60), minutes: m % 60 };
}

export const ROLE_LABEL: Record<string, string> = {
  trainee: "Trainee", membro: "Membro", gerente: "Gerente", capitao: "Capitão",
};
