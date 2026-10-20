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
  const result=await supabase.from('agenda_attendance').select('*, agenda_events!inner(id,title,kind,starts_at,attendance_enabled,status), agenda_invitees!inner(kind)');
  if(result.error) throw result.error;
  return result.data??[];
}});