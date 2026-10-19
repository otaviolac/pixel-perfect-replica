import type { Role } from './permissions';

export const EVENT_STATUS: Record<string, string> = { pending: 'Reunião pendente de aprovação', scheduled: 'Agendado', completed: 'Concluído', cancelled: 'Cancelado', rejected: 'Não aprovado' };
export const INVITE_KIND: Record<string, string> = { invitation: 'Convite', notice: 'Aviso', convocation: 'Convocação' };
export const RESPONSE: Record<string, string> = { pending: 'Sem resposta', yes: 'Vou participar', no: 'Não poderei' };
export type AgendaAuthority = { role: Role; sector_id: number; id: string };
export function canCreateEvent(role: Role | undefined, kind: string) {
  return role === 'capitao' || role === 'gerente' || (role === 'membro' && kind === 'meeting');
}
export function canInviteSector(role: Role, ownSector: number, invitedSector: number) {
  return role === 'capitao' || role === 'gerente' || (role === 'membro' && ownSector === invitedSector);
}
export function canManageEvent(me: AgendaAuthority | null | undefined, event: { sector_id: number; organizer_id: string; created_by: string }) {
  return !!me && (me.role === 'capitao' || (me.role === 'gerente' && (me.sector_id === event.sector_id || me.id === event.organizer_id || me.id === event.created_by)));
}
export function eventsOverlap(a: { starts_at: string; ends_at: string }, b: { starts_at: string; ends_at: string }) {
  return new Date(a.starts_at).getTime() < new Date(b.ends_at).getTime() && new Date(b.starts_at).getTime() < new Date(a.ends_at).getTime();
}