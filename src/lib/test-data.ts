import Papa from 'papaparse';

export type MeasurementColumn = { name: string; unit: string };
export type Measurements = { columns: MeasurementColumn[]; rows: (number | null)[][] };
export function parseMeasurements(csv: string): Measurements {
  if (new TextEncoder().encode(csv).length > 2 * 1024 * 1024) throw new Error('O CSV deve ter até 2 MB.');
  const parsed = Papa.parse<string[]>(csv.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
  if (parsed.errors.length) throw new Error(`CSV inválido: linha ${(parsed.errors[0].row ?? 0) + 1}.`);
  const [headers, ...records] = parsed.data;
  if (!headers || headers.length < 2 || headers.length > 30) throw new Error('O CSV precisa ter de 2 a 30 colunas.');
  const columns = headers.map(header => {
    const match = header.trim().match(/^(.+?)\s*\[([^\]]+)\]$/);
    if (!match) throw new Error(`Informe a unidade no cabeçalho: ${header || 'coluna sem nome'} [unidade].`);
    const name = match[1].trim(); const unit = match[2].trim();
    if (!name || !unit) throw new Error('Nome e unidade são obrigatórios.');
    return { name, unit };
  });
  if (new Set(columns.map(c => c.name.toLocaleLowerCase('pt-BR'))).size !== columns.length) throw new Error('Existem nomes de colunas repetidos.');
  if (!records.length || records.length > 10000) throw new Error('O CSV precisa ter de 1 a 10.000 linhas de medições.');
  const rows = records.map((record, index) => {
    if (record.length !== columns.length) throw new Error(`Linha ${index + 2}: quantidade de colunas inconsistente.`);
    return record.map((cell, col) => {
      const value = cell.trim();
      if (!value) return null;
      const normalized = value.replace(',', '.');
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized) || !Number.isFinite(Number(normalized))) throw new Error(`Linha ${index + 2}, coluna ${columns[col].name}: valor não numérico.`);
      return Number(normalized);
    });
  });
  return { columns, rows };
}

export function comparableColumns(a: MeasurementColumn, b: MeasurementColumn) {
  return a.name.trim().toLocaleLowerCase('pt-BR') === b.name.trim().toLocaleLowerCase('pt-BR') && a.unit.trim() === b.unit.trim();
}
export function readMeasurements(value: { columns: unknown; rows: unknown }): Measurements {
  if (!Array.isArray(value.columns) || !Array.isArray(value.rows)) throw new Error('Medições inválidas.');
  const columns = value.columns.map(c => {
    if (typeof c !== 'object' || c === null || !('name' in c) || !('unit' in c) || typeof c.name !== 'string' || typeof c.unit !== 'string') throw new Error('Colunas inválidas.');
    return { name: c.name, unit: c.unit };
  });
  const rows = value.rows.map(row => {
    if (!Array.isArray(row) || row.length !== columns.length || row.some(v => v !== null && (typeof v !== 'number' || !Number.isFinite(v)))) throw new Error('Linhas inválidas.');
    return row as (number | null)[];
  });
  return { columns, rows };
}