import { z } from 'zod';

export const tenantRoleSchema = z.enum(['ADMIN', 'MANAGER', 'WORKER']);

const tenantContextSchema = z
  .object({
    userId: z.string().uuid(),
    companyId: z.string().uuid(),
    role: tenantRoleSchema,
  })
  .readonly();

export type TenantContext = z.infer<typeof tenantContextSchema>;

/**
 * Only the server authentication layer may build this context. Browser input
 * is never a source for companyId, userId, or role.
 */
export function createTenantContextFromIdentity(
  identity: TenantContext,
): TenantContext {
  return tenantContextSchema.parse(identity);
}

export function requireTenantContext(
  context: TenantContext | undefined,
): TenantContext {
  if (!context) throw new Error('Tenant context is required.');
  return context;
}
