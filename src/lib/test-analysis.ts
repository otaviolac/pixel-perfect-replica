import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const testAnalysisQuery = (testId: string) => queryOptions({ queryKey: ['test-analysis', testId], queryFn: async () => {
  const sessions = await supabase.from('test_sessions').select('id').eq('test_id', testId);
  if (sessions.error) throw sessions.error;
  const ids = sessions.data.map(s => s.id);
  const [datasets, documents] = await Promise.all([
    ids.length ? supabase.from('test_datasets').select('*').in('session_id', ids).order('created_at') : Promise.resolve({ data: [], error: null }),
    supabase.from('test_documents').select('*').eq('test_id', testId).order('revision', { ascending: false }),
  ]);
  if (datasets.error) throw datasets.error;
  if (documents.error) throw documents.error;
  return { datasets: datasets.data ?? [], documents: documents.data ?? [] };
}});