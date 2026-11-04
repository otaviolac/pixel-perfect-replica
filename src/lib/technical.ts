import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

async function run<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const r = await p;
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as T;
}

export const aircraftQuery = queryOptions({ queryKey: ['tech', 'aircraft'], queryFn: async () => {
  const [aircraft, params] = await Promise.all([
    run(supabase.from('aircraft').select('*').is('archived_at', null).order('created_at')),
    run(supabase.from('aircraft_parameters').select('*').is('archived_at', null).order('name')),
  ]);
  return { aircraft, params };
}});
export const paramHistoryQuery = (id: string) => queryOptions({ queryKey: ['tech', 'param-history', id], queryFn: () =>
  run(supabase.from('aircraft_parameter_history').select('*').eq('parameter_id', id).order('changed_at', { ascending: false })) });
export const flightsQuery = queryOptions({ queryKey: ['tech', 'flights'], queryFn: async () => {
  const [flights, notes, contributors] = await Promise.all([
    run(supabase.from('flights').select('*').is('archived_at', null).order('flown_at', { ascending: false })),
    run(supabase.from('flight_notes').select('*').order('created_at')),
    run(supabase.from('flight_contributors').select('*')),
  ]);
  return { flights, notes, contributors };
}});
export const fabricationQuery = queryOptions({ queryKey: ['tech', 'fabrication'], queryFn: () =>
  run(supabase.from('fabrication_items').select('*').is('archived_at', null).order('created_at')) });
export const problemsQuery = queryOptions({ queryKey: ['tech', 'problems'], queryFn: () =>
  run(supabase.from('problems').select('*').order('code', { ascending: false })) });
export const knowledgeQuery = (q: string) => queryOptions({ queryKey: ['tech', 'knowledge', q], queryFn: () => {
  let s = supabase.from('knowledge_entries').select('*').is('archived_at', null).order('entry_date', { ascending: false });
  if (q.trim()) s = s.textSearch('search', q.trim(), { type: 'websearch', config: 'portuguese' });
  return run(s);
}});
export const trainingQuery = queryOptions({ queryKey: ['tech', 'training'], queryFn: async () => {
  const [resources, completions] = await Promise.all([
    run(supabase.from('training_resources').select('*').is('archived_at', null).order('title')),
    run(supabase.from('training_completions').select('*')),
  ]);
  return { resources, completions };
}});
export const techHistoryQuery = (kind: string, id: string) => queryOptions({ queryKey: ['tech', 'history', kind, id], queryFn: () =>
  run(supabase.from('technical_history').select('*').eq('kind', kind).eq('record_id', id).order('created_at', { ascending: false })) });

/** Executa uma gravação protegida pelas regras do banco e recarrega os dados técnicos. */
export function useTechSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
      const r = await fn();
      if (r.error) throw new Error(r.error.message);
    },
    onSuccess: () => { toast.success('Salvo.'); qc.invalidateQueries({ queryKey: ['tech'] }); },
    onError: (e: Error) => toast.error(e.message.includes('row-level security') ? 'Você não tem permissão para esta ação.' : e.message),
  });
}

export const blank = (v: FormDataEntryValue | null) => { const s = String(v ?? '').trim(); return s ? s : null; };
