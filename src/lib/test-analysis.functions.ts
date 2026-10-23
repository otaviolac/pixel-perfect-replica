import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Json } from '@/integrations/supabase/types';

export const testAnalysisCommand = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(value => z.object({ action: z.enum(['dataset', 'document']), test: z.string().uuid(), session: z.string().uuid().optional(), payload: z.record(z.unknown()) }).parse(value))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc('test_analysis_command', {
      _action: data.action, _test: data.test,
      ...(data.session ? { _session: data.session } : {}),
      _data: JSON.parse(JSON.stringify(data.payload)) as Json,
    });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });