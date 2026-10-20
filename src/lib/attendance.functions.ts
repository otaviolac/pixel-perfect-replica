import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
export const attendanceCommand = createServerFn({method:'POST'})
  .middleware([requireSupabaseAuth])
  .inputValidator(value => z.object({event:z.string().uuid(),action:z.enum(['toggle','record','summon']),payload:z.object({enabled:z.boolean().optional(),user_id:z.string().uuid().optional(),status:z.enum(['present','absent','justified','excused','unrecorded']).optional(),note:z.string().max(2000).optional()})}).parse(value))
  .handler(async ({data,context}) => {
    const result = await context.supabase.rpc('attendance_command',{_event:data.event,_action:data.action,_data:data.payload});
    if(result.error) throw new Error(result.error.message);
    return {id:result.data};
  });