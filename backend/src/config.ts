import { isIP } from 'node:net';
import { z } from 'zod';
const trustProxySchema = z
  .string()
  .default('false')
  .transform((value, context) => {
    if (value === 'false') return false;
    // Trust only explicitly configured proxy addresses, never arbitrary senders.
    const entries = value.split(',').map((entry) => entry.trim());
    const valid = entries.every((entry) => {
      const [address, prefix, extra] = entry.split('/');
      const family = isIP(address ?? '');
      return (
        family !== 0 &&
        extra === undefined &&
        (prefix === undefined ||
          (/^\d+$/.test(prefix) && Number(prefix) <= (family === 4 ? 32 : 128)))
      );
    });
    if (!valid) {
      context.addIssue({
        code: 'custom',
        message: 'Expected false or explicit proxy IP addresses/CIDRs',
      });
      return z.NEVER;
    }
    return entries;
  });
const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_URL: z.url().default('http://localhost:3000'),
  TRUST_PROXY: trustProxySchema,
  DATABASE_URL: z.union([z.url(), z.literal('A_REMPLIR')]).optional(),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});
export function parseEnvironment(environment: NodeJS.ProcessEnv) {
  const result = environmentSchema.safeParse(environment);
  if (!result.success)
    throw new Error(
      'Invalid environment variables: ' +
        result.error.issues.map((issue) => issue.path.join('.')).join(', '),
    );
  return result.data;
}
export function requireDatabaseUrl(config: Environment) {
  if (!config.DATABASE_URL || config.DATABASE_URL === 'A_REMPLIR') {
    throw new Error('DATABASE_URL is required for database operations.');
  }
  return config.DATABASE_URL;
}

export type Environment = ReturnType<typeof parseEnvironment>;
