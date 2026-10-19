import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Task = Tables<'tasks'>;
export const flagsQuery = queryOptions({ queryKey: ['flags'], queryFn: async () => {
  const { data, error } = await supabase.from('feature_flags').select('key,enabled');
  if (error) throw error;
  return data ?? [];
}});
export const tasksQuery = queryOptions({ queryKey: ['tasks'], queryFn: async () => {
  const { data, error } = await supabase.from('tasks').select('*').is('archived_at', null).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}});
export const notificationsQuery = queryOptions({ queryKey: ['notifications'], queryFn: async () => {
  const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return data ?? [];
}, refetchInterval: 30000 });
export const requestsQuery = queryOptions({ queryKey: ['requests'], queryFn: async () => {
  const { data, error } = await supabase.from('task_collaborations').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}});
export const taskDetailQuery = (id: string) => queryOptions({ queryKey: ['task', id], queryFn: async () => {
  const [task, participants, items, comments, history, collaborations, dependencies] = await Promise.all([
    supabase.from('tasks').select('*').eq('id', id).single(),
    supabase.from('task_participants').select('*').eq('task_id', id),
    supabase.from('task_items').select('*').eq('task_id', id).order('created_at'),
    supabase.from('task_comments').select('*').eq('task_id', id).order('created_at'),
    supabase.from('task_history').select('*').eq('task_id', id).order('created_at', { ascending: false }),
    supabase.from('task_collaborations').select('*').eq('task_id', id),
    supabase.from('task_dependencies').select('*').eq('task_id', id),
  ]);
  for (const result of [task, participants, items, comments, history, collaborations, dependencies]) if (result.error) throw result.error;
  if (!task.data) throw new Error('Tarefa não encontrada.');
  return { task: task.data, participants: participants.data ?? [], items: items.data ?? [], comments: comments.data ?? [], history: history.data ?? [], collaborations: collaborations.data ?? [], dependencies: dependencies.data ?? [] };
}});
export function pageHead(title: string, description: string) {
  return { meta: [{ title: `${title} — App Aerodesign` }, { name: 'description', content: description }, { property: 'og:title', content: `${title} — App Aerodesign` }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] };
}