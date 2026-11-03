import { describe, it, expect } from 'vitest';
import { canEditAircraft, managesSector, canReportProblem, closureMissing, parameterValue, dependentCalc } from '@/lib/technical-rules';

describe('Regras técnicas', () => {
  it('membro não edita dados da aeronave', () => expect(canEditAircraft('membro')).toBe(false));
  it('gerente de qualquer setor edita dados da aeronave', () => expect(canEditAircraft('gerente')).toBe(true));
  it('gerente não administra voo de outro setor', () => expect(managesSector({ id: 'g', role: 'gerente', sector_id: 1 }, 2)).toBe(false));
  it('trainee pode registrar problema', () => expect(canReportProblem('trainee')).toBe(true));
  it('fechamento exige documentação', () => expect(closureMissing('closed', '  ')).toBe(true));
  it('valor ausente aparece como Pendente, nunca zero', () => expect(parameterValue({ value: null, text_value: null, unit: 'm' })).toBe('Pendente'));
  it('zero medido continua zero', () => expect(parameterValue({ value: 0, text_value: null, unit: 'kg' })).toBe('0 kg'));
  it('cálculo com dado ausente fica indisponível com motivo', () => expect(dependentCalc({ envergadura: 2, corda: null }, v => v.envergadura * v.corda)).toEqual({ ok: false, reason: 'Indisponível: falta corda.' }));
});
