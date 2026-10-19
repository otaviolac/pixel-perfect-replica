import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const taskCommand = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => z.object({ action: z.enum(['create', 'edit', 'status', 'join', 'leave', 'consent', 'decline', 'convert', 'invite', 'decide', 'assign', 'item', 'item_status', 'dependency', 'remove_dependency', 'comment']), task: z.string().uuid().optional(), payload: z.record(z.unknown()).default({}) }).parse(value))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc('task_command', { _action: data.action, ...(data.task ? { _task: data.task } : {}), _data: data.payload as import('@/integrations/supabase/types').Json });
    if (error) throw new Error(error.message);
    return { id };
  });