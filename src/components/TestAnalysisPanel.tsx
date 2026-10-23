import { useState } from 'react';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Upload, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { testAnalysisQuery } from '@/lib/test-analysis';
import { testAnalysisCommand } from '@/lib/test-analysis.functions';
import { parseMeasurements, readMeasurements, comparableColumns, type Measurements } from '@/lib/test-data';
import { fmtDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Tables } from '@/integrations/supabase/types';

export function TestAnalysisPanel({ testId, sessionId, sessions, editable, canIssue }: { testId: string; sessionId?: string; sessions: Tables<'test_sessions'>[]; editable: boolean; canIssue: boolean }) {
  const { data } = useSuspenseQuery(testAnalysisQuery(testId));
  const command = useServerFn(testAnalysisCommand); const qc = useQueryClient();
  const [preview, setPreview] = useState<Measurements | null>(null); const [filename, setFilename] = useState('');
  const [note, setNote] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState(''); const [compare, setCompare] = useState(''); const [x, setX] = useState(0); const [y, setY] = useState(1);
  const sessionDatasets = data.datasets.filter(d => d.session_id === sessionId);
  const selected = sessionDatasets.find(d => d.id === chosen) ?? sessionDatasets.at(-1);
  const measurement = selected ? readMeasurements(selected) : null;
  const comparison = data.datasets.find(d => d.id === compare && d.session_id !== sessionId);
  const other = comparison ? readMeasurements(comparison) : null;
  const xColumn = measurement?.columns[x]; const yColumn = measurement?.columns[y];
  const otherX = other && xColumn ? other.columns.findIndex(c => comparableColumns(c, xColumn)) : -1;
  const otherY = other && yColumn ? other.columns.findIndex(c => comparableColumns(c, yColumn)) : -1;
  const compatible = !!other && otherX >= 0 && otherY >= 0;
  const options = 'h-10 min-w-0 w-full rounded-md border border-input bg-background px-3 text-sm';
  const sessionLabel = (id: string) => `Sessão ${sessions.findIndex(s => s.id === id) + 1}`;
  const chartRows = (values: Measurements, xIndex: number, yIndex: number, key: string) => values.rows.filter(row => row[xIndex] !== null).map(row => ({ axis: row[xIndex], [key]: row[yIndex] })).sort((a, b) => Number(a.axis) - Number(b.axis));

  async function load(file: File | undefined) {
    setPreview(null); setError(''); if (!file) return;
    try { if (file.size > 2 * 1024 * 1024) throw new Error('O CSV deve ter até 2 MB.'); setPreview(parseMeasurements(await file.text())); setFilename(file.name); }
    catch (err) { setError(err instanceof Error ? err.message : 'CSV inválido.'); }
  }
  async function save() {
    if (!preview || !sessionId) return;
    setBusy(true);
    try {
      const id = await command({ data: { action: 'dataset', test: testId, session: sessionId, payload: { ...preview, filename, metadata: { note } } } });
      await qc.invalidateQueries({ queryKey: ['test-analysis', testId] }); await qc.invalidateQueries({ queryKey: ['test', testId] });
      setChosen(id); setCompare(''); setX(0); setY(1); setPreview(null); setNote(''); toast.success('Medições registradas nesta sessão.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.'); } finally { setBusy(false); }
  }
  async function download(record: Tables<'test_documents'>) {
    try { const { downloadTestPdf } = await import('@/lib/test-pdf'); downloadTestPdf(record); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível gerar o PDF.'); }
  }
  async function issue() {
    setBusy(true);
    try {
      const id = await command({ data: { action: 'document', test: testId, payload: {} } });
      const fresh = await qc.fetchQuery({ ...testAnalysisQuery(testId), staleTime: 0 });
      const record = fresh.documents.find(d => d.id === id);
      if (!record) throw new Error('Documento não encontrado após emissão.');
      await download(record); toast.success(`Documento emitido · revisão ${record.revision}.`);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Não foi possível emitir.'); } finally { setBusy(false); }
  }
  return <>
    <section className="space-y-4 border-t pt-5"><h2 className="flex items-center gap-2 font-semibold"><Upload className="h-4 w-4"/>Medições da sessão</h2>
      {editable && <div className="space-y-3"><Label htmlFor="measurement-csv">Arquivo CSV · cabeçalhos com nome [unidade]</Label><Input id="measurement-csv" type="file" accept=".csv,text/csv" disabled={busy} onChange={e => load(e.target.files?.[0])}/>
        {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
        {preview && <><p className="text-sm">{filename} · {preview.rows.length} linhas · {preview.columns.length} colunas</p><MeasurementTable measurements={preview}/><Label htmlFor="measurement-note">Metadados / origem das medições — opcional</Label><Textarea id="measurement-note" value={note} onChange={e => setNote(e.target.value)}/><Button disabled={busy} onClick={save}><Upload className="h-4 w-4"/>Registrar medições</Button></>}
      </div>}
      {selected && measurement ? <><Label htmlFor="measurement-record">Arquivo registrado</Label><select id="measurement-record" className={options} value={selected.id} onChange={e => { setChosen(e.target.value); setX(0); setY(1); setCompare(''); }}>{sessionDatasets.map(d => <option key={d.id} value={d.id}>{d.filename} · {fmtDateTime(d.created_at)}</option>)}</select><MeasurementTable measurements={measurement}/>
        <div className="grid gap-3 sm:grid-cols-2">{[['Eixo horizontal', x, setX], ['Eixo vertical', y, setY]].map(([label, value, setter]) => <div key={String(label)} className="space-y-2"><Label htmlFor={String(label)}>{String(label)}</Label><select id={String(label)} className={options} value={Number(value)} onChange={e => { if (typeof setter === 'function') setter(Number(e.target.value)); }}>{measurement.columns.map((c, i) => <option key={i} value={i}>{c.name} [{c.unit}]</option>)}</select></div>)}</div>
        <Label htmlFor="measurement-comparison">Comparar com outra sessão</Label><select id="measurement-comparison" className={options} value={compare} onChange={e => setCompare(e.target.value)}><option value="">Sem comparação</option>{data.datasets.filter(d => d.session_id !== sessionId).map(d => <option key={d.id} value={d.id}>{sessionLabel(d.session_id)} · {d.filename}</option>)}</select>
        {other && !compatible && <p role="alert" className="text-sm text-warning">Colunas ou unidades incompatíveis. Comparação indisponível.</p>}
        {xColumn && yColumn && <div className="h-80 min-w-0 w-full" role="img" aria-label={`Gráfico de ${yColumn.name} por ${xColumn.name}`}><ResponsiveContainer width="100%" height="100%"><LineChart margin={{ top: 15, right: 25, bottom: 28, left: 15 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3"/><XAxis dataKey="axis" type="number" domain={['dataMin', 'dataMax']} allowDuplicatedCategory={false} stroke="var(--muted-foreground)" label={{ value: `${xColumn.name} [${xColumn.unit}]`, position: 'bottom' }}/><YAxis stroke="var(--muted-foreground)" label={{ value: `${yColumn.name} [${yColumn.unit}]`, angle: -90, position: 'insideLeft' }}/><Tooltip/><Legend verticalAlign="top"/><Line data={chartRows(measurement, x, y, 'value')} dataKey="value" name={`${sessionLabel(selected.session_id)} · ${selected.filename}`} stroke="var(--primary)" dot={false} connectNulls={false} isAnimationActive={false}/>{compatible && other && comparison && <Line data={chartRows(other, otherX, otherY, 'comparison')} dataKey="comparison" name={`${sessionLabel(comparison.session_id)} · ${comparison.filename}`} stroke="var(--accent)" dot={false} connectNulls={false} isAnimationActive={false}/>}</LineChart></ResponsiveContainer></div>}
      </> : <p className="text-sm text-muted-foreground">Nenhum arquivo de medições registrado nesta sessão.</p>}
    </section>
    <section className="space-y-4 border-t pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4"/>Documentos de teste</h2>{canIssue && <Button variant="outline" disabled={busy} onClick={issue}><Download className="h-4 w-4"/>Emitir documento de teste</Button>}</div>
      {data.documents.length ? <div className="divide-y">{data.documents.map(d => <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><p className="text-sm">Revisão {d.revision} · {d.partial ? 'Emissão parcial' : 'Consolidado'} · {fmtDateTime(d.issued_at)}</p><Button variant="ghost" size="icon" aria-label={`Baixar revisão ${d.revision}`} title={`Baixar revisão ${d.revision}`} onClick={() => download(d)}><Download className="h-4 w-4"/></Button></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhum documento emitido.</p>}
    </section>
  </>;
}

function MeasurementTable({ measurements }: { measurements: Measurements }) {
  return <div className="max-h-64 overflow-auto border"><table className="w-full text-left text-xs"><thead className="bg-muted"><tr>{measurements.columns.map((c, i) => <th className="whitespace-nowrap px-3 py-2 font-medium" key={i}>{c.name} [{c.unit}]</th>)}</tr></thead><tbody className="divide-y">{measurements.rows.slice(0, 50).map((row, i) => <tr key={i}>{row.map((value, j) => <td className="whitespace-nowrap px-3 py-2" key={j}>{value === null ? '—' : value.toLocaleString('pt-BR')}</td>)}</tr>)}</tbody></table>{measurements.rows.length > 50 && <p className="p-3 text-xs text-muted-foreground">50 de {measurements.rows.length} linhas</p>}</div>;
}