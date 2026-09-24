import type { PrismaClient } from '@prisma/client';
import type { TenantContext } from '../../tenancy/context.js';
import { withTenant } from '../../tenancy/tenant-prisma.js';

export class TenantCompaniesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async current(context: TenantContext) {
    return withTenant(this.prisma, context, (transaction, tenant) =>
      transaction.company.findFirst({ where: { id: tenant.companyId } }),
    );
  }
}
