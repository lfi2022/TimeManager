import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { TenantContext } from '../../tenancy/context.js';
import { withTenant } from '../../tenancy/tenant-prisma.js';
const start = z
  .object({ worksiteId: z.string().uuid().nullable().optional() })
  .strict();
export class ClockService {
  constructor(private p: PrismaClient) {}
  async status(c: TenantContext) {
    return withTenant(this.p, c, (tx, t) =>
      tx.clockSession.findFirst({
        where: { companyId: t.companyId, userId: c.userId, stoppedAt: null },
      }),
    );
  }
  async start(c: TenantContext, raw: unknown) {
    const d = start.parse(raw);
    return withTenant(this.p, c, async (tx, t) => {
      if (
        await tx.clockSession.findFirst({
          where: { companyId: t.companyId, userId: c.userId, stoppedAt: null },
        })
      )
        return null;
      if (
        d.worksiteId &&
        !(await tx.worksite.findFirst({
          where: { id: d.worksiteId, companyId: t.companyId, active: true },
        }))
      )
        return null;
      return tx.clockSession.create({
        data: {
          companyId: t.companyId,
          userId: c.userId,
          worksiteId: d.worksiteId ?? null,
          startedAt: new Date(),
        },
      });
    });
  }
  async stop(c: TenantContext) {
    return withTenant(this.p, c, async (tx, t) => {
      const s = await tx.clockSession.findFirst({
        where: { companyId: t.companyId, userId: c.userId, stoppedAt: null },
      });
      if (!s) return null;
      const end = new Date(),
        worked = Math.max(
          0,
          Math.round((end.getTime() - s.startedAt.getTime()) / 60000),
        );
      await tx.clockSession.update({
        where: { id: s.id },
        data: { stoppedAt: end },
      });
      return tx.workEntry.create({
        data: {
          companyId: t.companyId,
          userId: c.userId,
          worksiteId: s.worksiteId,
          date: new Date(
            Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
          ),
          startTime: s.startedAt,
          endTime: end,
          breakMinutes: 0,
          workedMinutes: worked,
          expectedMinutes: 0,
          differenceMinutes: worked,
          source: 'CLOCK',
          createdByUserId: c.userId,
          updatedByUserId: c.userId,
        },
      });
    });
  }
}
