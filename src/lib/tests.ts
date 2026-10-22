import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type TeamTest = Tables<'tests'>;
export const checklistsQuery = queryOptions({ queryKey: ['test-checklists'], queryFn: async () => {
  const result = await supabase.from('test_checklists').select('*').order('version', { ascending: false });
  if (result.error) throw result.error;
  return result.data;
}});
export const testsQuery = queryOptions({ queryKey: ['tests'], queryFn: async () => {
  const [tests, sessions, events, invitations] = await Promise.all([
    supabase.from('tests').select('*').order('created_at', { ascending: false }),
    supabase.from('test_sessions').select('*').order('created_at'),
    supabase.from('agenda_events').select('*').not('test_mode', 'is', null),
    supabase.from('test_sector_invitations').select('*'),
  ]);
  for (const result of [tests, sessions, events, invitations]) if (result.error) throw result.error;
  return { tests: tests.data ?? [], sessions: sessions.data ?? [], events: events.data ?? [], invitations: invitations.data ?? [] };
}});
export const testDetailQuery = (id: string) => queryOptions({ queryKey: ['test', id], queryFn: async () => {
  const [test, sessions] = await Promise.all([
    supabase.from('tests').select('*').eq('id', id).single(),
    supabase.from('test_sessions').select('*').eq('test_id', id).order('created_at'),
  ]);
  if (test.error) throw test.error;
  if (sessions.error) throw sessions.error;
  if (!test.data) throw new Error('Teste não encontrado.');
  const sessionIds = sessions.data.map(s => s.id);
  const eventIds = sessions.data.map(s => s.event_id);
  if (!eventIds.length) return { test: test.data, sessions: sessions.data, events: [], invitees: [], history: [], acknowledgments: [], invitations: [] };
  const [events, invitees, history, acknowledgments, invitations] = await Promise.all([
    supabase.from('agenda_events').select('*').in('id', eventIds),
    supabase.from('agenda_invitees').select('*').in('event_id', eventIds),
    supabase.from('agenda_history').select('*').in('event_id', eventIds).order('created_at', { ascending: false }),
    supabase.from('test_safety_acknowledgments').select('*').in('session_id', sessionIds),
    supabase.from('test_sector_invitations').select('*').in('session_id', sessionIds),
  ]);
  for (const result of [events, invitees, history, acknowledgments, invitations]) if (result.error) throw result.error;
  return { test: test.data, sessions: sessions.data, events: events.data ?? [], invitees: invitees.data ?? [], history: history.data ?? [], acknowledgments: acknowledgments.data ?? [], invitations: invitations.data ?? [] };
}});