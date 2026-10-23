import { describe, it, expect } from 'vitest';
import { parseMeasurements, comparableColumns } from '@/lib/test-data';

describe('Medições de ensaios', () => {
  it('mantém campo ausente como null e zero medido como zero', () => {
    expect(parseMeasurements('Tempo [s];Força [N]\n0;\n1;0').rows).toEqual([[0, null], [1, 0]]);
  });
  it('valida unidades no cabeçalho', () => {
    expect(() => parseMeasurements('Tempo;Força [N]\n0;2')).toThrow('unidade');
  });
  it('recusa quantidade inconsistente de colunas', () => {
    expect(() => parseMeasurements('Tempo [s];Força [N]\n0;1;2')).toThrow('quantidade');
  });
  it('recusa medidas não numéricas', () => {
    expect(() => parseMeasurements('Tempo [s];Força [N]\n0;ausente')).toThrow('não numérico');
  });
  it('não compara unidades diferentes como equivalentes', () => {
    expect(comparableColumns({ name: 'Força', unit: 'N' }, { name: 'Força', unit: 'kgf' })).toBe(false);
  });
  it('aceita decimal brasileiro em CSV separado por ponto e vírgula', () => {
    expect(parseMeasurements('Tempo [s];Força [N]\n0;1,25').rows[0]).toEqual([0, 1.25]);
  });
  it('recusa nomes duplicados', () => {
    expect(() => parseMeasurements('Tempo [s];tempo [s]\n0;1')).toThrow('repetidos');
  });
});