import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Json } from '@/integrations/supabase/types';

export const testCommand = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(value => z.object({
    action: z.enum(['create', 'session', 'checklist', 'approve', 'reject', 'results', 'status', 'invite', 'decide', 'archive']),
    test: z.string().uuid().optional(), session: z.string().uuid().optional(),
    payload: z.record(z.unknown()),
  }).parse(value))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc('test_command', {
      _action: data.action, _data: JSON.parse(JSON.stringify(data.payload)) as Json,
      ...(data.test ? { _test: data.test } : {}),
      ...(data.session ? { _session: data.session } : {}),
    });
    if (result.error) throw new Error(result.error.message);
    return { id: result.data };
  });