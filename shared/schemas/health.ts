import { z } from 'zod';
export const healthResponseSchema = z.object({
  data: z.object({ status: z.literal('ok'), version: z.literal('0.1.0') }),
});
