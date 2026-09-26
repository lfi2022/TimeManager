import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { TenantContext } from '../../tenancy/context.js';
import { withTenant } from '../../tenancy/tenant-prisma.js';

const tenantUserInputSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320),
    passwordHash: z.string().min(1),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    role: z.enum(['ADMIN', 'MANAGER', 'WORKER']),
    employeeNumber: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .transform((value) => value ?? null),
    phone: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .optional()
      .transform((value) => value ?? null),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .transform((value) => value ?? null),
    locale: z
      .string()
      .trim()
      .min(1)
      .max(35)
      .optional()
      .transform((value) => value ?? null),
  })
  .strict();

export type CreateTenantUserInput = z.input<typeof tenantUserInputSchema>;

export class TenantUsersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(context: TenantContext) {
    return withTenant(this.prisma, context, (transaction, tenant) =>
      transaction.user.findMany({
        where: { companyId: tenant.companyId },
        orderBy: { email: 'asc' },
      }),
    );
  }

  async findById(context: TenantContext, userId: string) {
    return withTenant(this.prisma, context, (transaction, tenant) =>
      transaction.user.findFirst({
        where: { id: userId, companyId: tenant.companyId },
      }),
    );
  }

  async create(context: TenantContext, input: CreateTenantUserInput) {
    const data = tenantUserInputSchema.parse(input);
    return withTenant(this.prisma, context, (transaction, tenant) =>
      transaction.user.create({
        data: { ...data, companyId: tenant.companyId },
      }),
    );
  }
}
