import type { CompanyRole } from '@prisma/client';
import type { TenantContext } from '../tenancy/context.js';

export function requireRole(
  context: TenantContext,
  roles: readonly CompanyRole[],
) {
  if (!roles.includes(context.role)) throw new Error('Insufficient role.');
}
