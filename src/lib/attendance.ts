import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
export const eventAttendanceQuery = (id:string) => queryOptions({queryKey:['attendance',id],queryFn:async()=>{
  const [records,history] = await Promise.all([
    supabase.from('agenda_attendance').select('*').eq('event_id',id),
    supabase.from('agenda_attendance_history').select('*').eq('event_id',id).order('created_at',{ascending:false}),
  ]);
  if(records.error) throw records.error;
  if(history.error) throw history.error;
  return {records:records.data??[],history:history.data??[]};
}});
export const attendanceQuery = queryOptions({queryKey:['attendance-summary'],queryFn:async()=>{
  const result=await supabase.from('agenda_attendance').select('*, agenda_events!inner(id,title,kind,starts_at,attendance_enabled,status)');
  if(result.error) throw result.error;
  const invitations=await supabase.from('agenda_invitees').select('event_id,user_id,kind');
  if(invitations.error) throw invitations.error;
  return (result.data??[]).map(r=>({...r,invite_kind:invitations.data?.find(i=>i.event_id===r.event_id&&i.user_id===r.user_id)?.kind??'notice'}));
}});