import type { Role } from './permissions';

export const TASK_STATUS = { pending: 'Pendente', progress: 'Em andamento', approval: 'Aguardando aprovação', blocked: 'Bloqueada', completed: 'Concluída', cancelled: 'Cancelada' } as const;
export type TaskStatus = keyof typeof TASK_STATUS;
export function canCreateTask(role: Role, kind: 'official' | 'voluntary', ownSector: number, targetSector: number) {
  if (role === 'capitao') return true;
  return ownSector === targetSector && (kind === 'official' ? role === 'gerente' : role !== 'trainee');
}
export function canManageTask(role: Role, sector: number, taskSector: number, acceptedSectors: number[], voluntaryOwner: boolean) {
  return role === 'capitao' || voluntaryOwner || (role === 'gerente' && (sector === taskSector || acceptedSectors.includes(sector)));
}
export function deadlineState(due: string | null, status: string, now = Date.now()) {
  if (!due || ['completed', 'cancelled'].includes(status)) return 'none';
  const left = new Date(due).getTime() - now;
  return left < 0 ? 'overdue' : left <= 86400000 ? 'soon' : 'normal';
}
export function wouldCycle(edges: { task_id: string; depends_on: string }[], task: string, dependency: string) {
  const visited = new Set<string>();
  const pending = [dependency];
  while (pending.length) {
    const node = pending.pop();
    if (!node) continue;
    if (node === task) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    pending.push(...edges.filter(e => e.task_id === node).map(e => e.depends_on));
  }
  return false;
}