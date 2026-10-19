import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Json } from '@/integrations/supabase/types';

export const agendaCommand = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(value => z.object({ action: z.enum(['create','edit','approve','reject','respond','cancel','complete','minutes','archive','file']), event: z.string().uuid().optional(), payload: z.record(z.unknown()).default({}) }).parse(value))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc('agenda_command', { _action: data.action, ...data.event ? { _event: data.event } : {}, _data: data.payload as Json });
    if (result.error) throw new Error(result.error.message);
    return { id: result.data };
  });