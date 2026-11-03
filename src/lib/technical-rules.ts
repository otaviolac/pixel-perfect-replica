import type { Role } from './permissions';

export const AIRCRAFT_CATEGORY: Record<string, string> = {
  geometria: 'Geometria', massas_cg: 'Massas e CG', aerodinamica: 'Aerodinâmica', propulsao: 'Propulsão / motogrupo',
  eletrica: 'Elétrica / baterias', desempenho: 'Desempenho', estabilidade: 'Estabilidade e controle', estruturas: 'Estruturas',
  cargas: 'Cargas e aeroelasticidade', outros: 'Demais parâmetros',
};
export const VALUE_ORIGIN: Record<string, string> = { estimado: 'Estimado', calculado: 'Calculado', medido: 'Medido experimentalmente' };
export const FAB_STATUS: Record<string, string> = { not_started: 'Não iniciado', in_progress: 'Em fabricação', awaiting_fix: 'Aguardando correção', done: 'Concluído' };
export const PROBLEM_STATUS: Record<string, string> = { open: 'Registrado', triage: 'Em triagem', in_progress: 'Em tratamento', resolved: 'Resolvido', closed: 'Fechado' };
export const CRITICALITY: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };
export const PROBLEM_SCOPE: Record<string, string> = { aeronave: 'Aeronave', equipamento: 'Equipamento', processo: 'Processo', evento: 'Evento' };
export const KNOWLEDGE_KIND: Record<string, string> = { decisao: 'Decisão', solucao: 'Solução', experiencia: 'Experiência', problema: 'Problema', relatorio: 'Relatório', documento: 'Documento', material: 'Material', aprendizado: 'Aprendizado' };

type Person = { id: string; role: Role; sector_id: number };

/** Todos os gerentes e o capitão editam qualquer categoria da aeronave. */
export const canEditAircraft = (role: Role | null | undefined) => role === 'gerente' || role === 'capitao';
/** Gerência do setor ou capitão. */
export const managesSector = (me: Person | null | undefined, sector: number) => !!me && (me.role === 'capitao' || (me.role === 'gerente' && me.sector_id === sector));
/** Qualquer integrante ativo, inclusive trainee, registra problemas. */
export const canReportProblem = (role: Role | null | undefined) => !!role;
export const closureMissing = (status: string, note: string | null | undefined) => status === 'closed' && !note?.trim();

/** Valor ausente nunca vira zero. */
export function parameterValue(p: { value: number | null; text_value: string | null; unit: string }) {
  if (p.value !== null && p.value !== undefined) return `${p.value.toLocaleString('pt-BR')} ${p.unit}`;
  if (p.text_value?.trim()) return `${p.text_value} ${p.unit}`;
  return 'Pendente';
}
/** Cálculo dependente: indisponível com o motivo quando falta algum dado. */
export function dependentCalc(inputs: Record<string, number | null | undefined>, fn: (v: Record<string, number>) => number) {
  const missing = Object.entries(inputs).filter(([, v]) => v === null || v === undefined).map(([k]) => k);
  if (missing.length) return { ok: false as const, reason: `Indisponível: falta ${missing.join(', ')}.` };
  return { ok: true as const, value: fn(inputs as Record<string, number>) };
}
