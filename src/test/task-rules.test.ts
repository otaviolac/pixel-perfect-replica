import { describe, expect, it } from 'vitest';
import { canCreateTask, canManageTask, deadlineState, wouldCycle } from '@/lib/task-rules';
describe('tarefas operacionais', () => {
  it('trainee não cria tarefas, mas membro cria somente voluntárias', () => {
    expect(canCreateTask('trainee', 'official', 1, 1)).toBe(false);
    expect(canCreateTask('trainee', 'voluntary', 1, 1)).toBe(false);
    expect(canCreateTask('membro', 'official', 1, 1)).toBe(false);
    expect(canCreateTask('membro', 'voluntary', 1, 1)).toBe(true);
  });
  it('gerente cria oficiais apenas do próprio setor e capitão de qualquer setor', () => {
    expect(canCreateTask('gerente', 'official', 1, 2)).toBe(false);
    expect(canCreateTask('gerente', 'official', 1, 1)).toBe(true);
    expect(canCreateTask('capitao', 'official', 1, 8)).toBe(true);
  });
  it('gerente convidado tem autoridade igual após aceite', () => {
    expect(canManageTask('gerente', 2, 1, [], false)).toBe(false);
    expect(canManageTask('gerente', 2, 1, [2], false)).toBe(true);
    expect(canManageTask('gerente', 1, 1, [2], false)).toBe(true);
    expect(canManageTask('capitao', 8, 1, [], false)).toBe(true);
    expect(canManageTask('membro', 1, 1, [], false)).toBe(false);
  });
  it('dependências não podem formar ciclos', () => {
    expect(wouldCycle([{ task_id: 'a', depends_on: 'b' }], 'b', 'a')).toBe(true);
    expect(wouldCycle([], 'a', 'a')).toBe(true);
    expect(wouldCycle([{ task_id: 'a', depends_on: 'b' }], 'c', 'a')).toBe(false);
  });
  it('atraso não altera estado e tarefa concluída não aparece atrasada', () => {
    const due = '2026-10-19T14:00:00Z'; const now = Date.parse('2026-10-19T15:00:00Z');
    expect(deadlineState(due, 'progress', now)).toBe('overdue');
    expect(deadlineState(due, 'completed', now)).toBe('none');
    expect(deadlineState(null, 'pending', now)).toBe('none');
  });
});