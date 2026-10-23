import { jsPDF } from 'jspdf';
import { fmtDateTime } from '@/lib/format';
import { TEST_STATUS, TEST_MODE } from '@/lib/test-rules';
import type { Tables } from '@/integrations/supabase/types';

type Obj = Record<string, unknown>;
const object = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const array = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const text = (v: unknown) => typeof v === 'string' || typeof v === 'number' ? String(v) : '';

export function buildTestPdf(record: Tables<'test_documents'>) {
  const snapshot = object(record.snapshot); const test = object(snapshot['test']);
  const doc = new jsPDF(); const margin = 18; const width = 174; let y = 20;
  const add = (label: string, value: unknown, heading = false) => {
    const valueText = text(value).trim(); if (!valueText) return;
    doc.setFont('helvetica', heading ? 'bold' : 'normal'); doc.setFontSize(heading ? 13 : 10);
    const lines = doc.splitTextToSize(label ? `${label}: ${valueText}` : valueText, width) as string[];
    for (const line of lines) {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(line, margin, y); y += heading ? 7 : 5;
    }
    y += 3;
  };
  add('', 'App Aerodesign — Documento de teste', true);
  add('', test['title'], true);
  add('Código', test['code']); add('Revisão', record.revision);
  add('Emissão', record.partial ? 'PARCIAL — sessões não concluídas' : 'Consolidada');
  add('Emitido em', fmtDateTime(record.issued_at)); add('Emitido por', snapshot['issuer']);
  add('Modalidade', TEST_MODE[text(test['mode']) as keyof typeof TEST_MODE]); add('Setor', snapshot['sector']);
  for (const [key, label] of [['type', 'Tipo'], ['objective', 'Objetivo'], ['configuration', 'Configuração da aeronave'], ['materials', 'Materiais'], ['equipment', 'Equipamentos'], ['procedure', 'Procedimento'], ['observations', 'Observações']] as const) add(label, test[key]);
  array(snapshot['sessions']).forEach((value, index) => {
    const session = object(value); const event = object(session['event']);
    add('', `Sessão ${index + 1}`, true); add('Situação', TEST_STATUS[text(session['status'])]);
    add('Início', event['starts_at'] ? fmtDateTime(text(event['starts_at'])) : '');
    add('Término registrado na agenda', event['ends_at'] ? fmtDateTime(text(event['ends_at'])) : '');
    add('Local', event['location']); add('Responsável', session['responsible']);
    array(session['participants']).forEach(p => add('Participante', object(p)['name']));
    add('Condições', session['conditions']); add('Resultados', session['results']); add('Observação / motivo', session['note']);
    array(session['safety']).forEach(value => {
      const safety = object(value); add('Ciência de segurança', `${text(safety['name'])} — versão ${text(safety['version'])} — ${fmtDateTime(text(safety['accepted_at']))}`); add('Checklist aceito', safety['body']);
    });
    array(session['datasets']).forEach(value => {
      const dataset = object(value); const columns = array(dataset['columns']).map(object);
      add('Arquivo de medições', dataset['filename']); add('Metadados', object(dataset['metadata'])['note']);
      add('Colunas', columns.map(c => `${text(c['name'])} [${text(c['unit'])}]`).join(' | '));
      array(dataset['rows']).forEach(row => add('', array(row).map(v => v === null ? '—' : text(v)).join(' | ')));
    });
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) { doc.setPage(page); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(`Revisão ${record.revision}${record.partial ? ' · Parcial' : ''} · Página ${page} de ${pages}`, margin, 288); }
  return doc;
}
export function downloadTestPdf(record: Tables<'test_documents'>) {
  buildTestPdf(record).save(`teste-revisao-${record.revision}.pdf`);
}