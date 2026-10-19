import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type AgendaEvent = Tables<'agenda_events'>;
export const agendaQuery = queryOptions({ queryKey: ['agenda'], queryFn: async () => {
  const [events, invitees] = await Promise.all([
    supabase.from('agenda_events').select('*').order('starts_at'),
    supabase.from('agenda_invitees').select('*'),
  ]);
  if (events.error) throw events.error;
  if (invitees.error) throw invitees.error;
  return { events: events.data ?? [], invitees: invitees.data ?? [] };
}});
export const agendaDetailQuery = (id: string) => queryOptions({ queryKey: ['agenda-event',id], queryFn: async () => {
  const [event, invitees, history, files] = await Promise.all([
    supabase.from('agenda_events').select('*').eq('id',id).single(),
    supabase.from('agenda_invitees').select('*').eq('event_id',id),
    supabase.from('agenda_history').select('*').eq('event_id',id).order('created_at',{ascending:false}),
    supabase.from('agenda_files').select('*').eq('event_id',id).order('created_at'),
  ]);
  for (const result of [event,invitees,history,files]) if (result.error) throw result.error;
  if (!event.data) throw new Error('Evento não encontrado.');
  return { event:event.data, invitees:invitees.data ?? [], history:history.data ?? [], files:files.data ?? [] };
}});