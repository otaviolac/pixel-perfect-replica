import type { Role } from './permissions';

export const TEST_STATUS: Record<string, string> = {
  planned: 'Planejado', pending: 'Pendente de aprovação', scheduled: 'Aprovado / Agendado',
  running: 'Em execução', result_pending: 'Teste realizado — Resultado pendente',
  completed: 'Teste concluído', interrupted: 'Interrompido', cancelled: 'Cancelado',
  inconclusive: 'Inconclusivo', rejected: 'Não aprovado / Arquivado',
};
export const TEST_MODE = { normal_test: 'Teste normal', quick_test: 'Teste rápido' };
export type TestActor = { id: string; role: Role; sector_id: number };
export function canCreateTest(role: Role | undefined) {
  return role === 'membro' || role === 'gerente' || role === 'capitao';
}
export function canManageTest(actor: TestActor | null | undefined, sector: number, organizer: string) {
  return !!actor && (actor.role === 'capitao' || (actor.role === 'gerente' && (actor.sector_id === sector || actor.id === organizer)));
}
export function canAddTestSession(actor: TestActor | null | undefined, test: { sector_id: number; created_by: string; archived_at: string | null }) {
  return !!actor && !test.archived_at && (actor.role === 'capitao' || (actor.sector_id === test.sector_id && (actor.role === 'gerente' || (actor.role === 'membro' && actor.id === test.created_by))));
}
export function sessionTransitions(status: string, manager: boolean, owner: boolean) {
  if (!manager && !owner) return [];
  const available = status === 'scheduled' ? ['running', 'inconclusive'] : status === 'running' ? ['result_pending', 'completed', 'inconclusive'] : status === 'result_pending' ? ['completed', 'inconclusive'] : [];
  return available.length && manager ? [...available, 'interrupted', 'cancelled'] : available;
}
export function resultsRequired(status: string, results: string) {
  return status === 'completed' && results.trim().length === 0;
}