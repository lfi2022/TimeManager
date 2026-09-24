import type { Prisma, PrismaClient, TimeBalanceType } from '@prisma/client';
import { z } from 'zod';
import { requireRole } from '../../security/authorization.js';
import type { TenantContext } from '../../tenancy/context.js';
import { withTenant } from '../../tenancy/tenant-prisma.js';
const adjustment = z
  .object({
    userId: z.string().uuid(),
    minutes: z
      .number()
      .int()
      .min(-1440)
      .max(1440)
      .refine((x) => x !== 0),
    type: z.enum([
      'RECOVERY',
      'MANUAL_ADJUSTMENT',
      'CORRECTION',
      'OPENING_BALANCE',
    ]),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();
export class TimeBalanceService {
  constructor(private prisma: PrismaClient) {}
  async history(c: TenantContext, userId?: string) {
    return withTenant(this.prisma, c, async (tx, t) => {
      const id = c.role === 'WORKER' ? c.userId : userId;
      if (!id) return [];
      return tx.timeBalanceTransaction.findMany({
        where: { companyId: t.companyId, userId: id },
        orderBy: { createdAt: 'desc' },
      });
    });
  }
  async balance(c: TenantContext, userId?: string) {
    const rows = await this.history(c, userId);
    return rows.reduce((s, x) => s + x.minutes, 0);
  }
  async adjust(c: TenantContext, raw: unknown) {
    requireRole(c, ['ADMIN']);
    const d = adjustment.parse(raw);
    const r = await withTenant(this.prisma, c, async (tx, t) => {
      const u = await tx.user.findFirst({
        where: { id: d.userId, companyId: t.companyId },
      });
      if (!u) return null;
      return tx.timeBalanceTransaction.create({
        data: {
          companyId: t.companyId,
          userId: d.userId,
          minutes: d.minutes,
          type: d.type as TimeBalanceType,
          reason: d.reason,
          createdByUserId: c.userId,
        },
      });
    });
    if (r)
      await withTenant(this.prisma, c, (tx) =>
        tx.auditEvent.create({
          data: {
            companyId: c.companyId,
            actorUserId: c.userId,
            action: 'TIME_BALANCE_ADJUSTED',
            entityType: 'TimeBalanceTransaction',
            entityId: r.id,
            metadata: { reason: d.reason } as Prisma.InputJsonValue,
          },
        }),
      );
    return r;
  }
}
