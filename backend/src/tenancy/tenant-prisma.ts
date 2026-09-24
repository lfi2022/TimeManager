import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireTenantContext, type TenantContext } from './context.js';

type TenantTransaction = Prisma.TransactionClient;
const companyIdSchema = z.string().uuid();

export async function withCompanyId<T>(
  prisma: PrismaClient,
  companyId: string,
  operation: (transaction: TenantTransaction) => Promise<T>,
): Promise<T> {
  const validCompanyId = companyIdSchema.parse(companyId);
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(
      'SELECT set_config($1, $2, true)',
      'app.company_id',
      validCompanyId,
    );
    return operation(transaction);
  });
}

export async function withTenant<T>(
  prisma: PrismaClient,
  context: TenantContext | undefined,
  operation: (
    transaction: TenantTransaction,
    tenant: TenantContext,
  ) => Promise<T>,
): Promise<T> {
  const tenant = requireTenantContext(context);
  return withCompanyId(prisma, tenant.companyId, (transaction) =>
    operation(transaction, tenant),
  );
}
