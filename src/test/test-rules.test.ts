import { describe, expect, it } from 'vitest';
import { canCreateTest, canManageTest, canAddTestSession, resultsRequired, sessionTransitions } from '@/lib/test-rules';

describe('Regras de testes e ensaios', () => {
  it('trainee não cria testes normais nem rápidos', () => expect(canCreateTest('trainee')).toBe(false));
  it('membro pode propor testes e iniciar rápidos', () => expect(canCreateTest('membro')).toBe(true));
  it('gerente não gerencia outro setor sem ser responsável', () => expect(canManageTest({ id: 'g', role: 'gerente', sector_id: 1 }, 2, 'outro')).toBe(false));
  it('capitão gerencia qualquer setor', () => expect(canManageTest({ id: 'c', role: 'capitao', sector_id: 1 }, 8, 'outro')).toBe(true));
  it('membro só adiciona sessão no próprio teste e setor', () => expect(canAddTestSession({ id: 'm', role: 'membro', sector_id: 1 }, { created_by: 'outro', sector_id: 1, archived_at: null })).toBe(false));
  it('teste realizado exige resultados para conclusão', () => expect(resultsRequired('completed', '  ')).toBe(true));
  it('interrupção não exige resultados', () => expect(resultsRequired('interrupted', '')).toBe(false));
  it('membro responsável não interrompe teste por autoridade gerencial', () => expect(sessionTransitions('running', false, true)).not.toContain('interrupted'));
  it('sessão encerrada não pode voltar a execução', () => expect(sessionTransitions('completed', true, true)).toEqual([]));
});