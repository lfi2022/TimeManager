import type { Prisma, PrismaClient } from '@prisma/client';
import { requireTenantContext, type TenantContext } from './context.js';

type TenantTransaction = Prisma.TransactionClient;

export async function withTenant<T>(
  prisma: PrismaClient,
  context: TenantContext | undefined,
  operation: (
    transaction: TenantTransaction,
    tenant: TenantContext,
  ) => Promise<T>,
): Promise<T> {
  const tenant = requireTenantContext(context);
  return prisma.$transaction(async (transaction) => {
    // The parameters are bound, and the setting is local to this transaction.
    await transaction.$executeRawUnsafe(
      'SELECT set_config($1, $2, true)',
      'app.company_id',
      tenant.companyId,
    );
    return operation(transaction, tenant);
  });
}
