import type { PrismaClient } from '@prisma/client';
import type { TenantContext } from '../../tenancy/context.js';
import { withTenant } from '../../tenancy/tenant-prisma.js';
export class DashboardService {
  constructor(private p: PrismaClient) {}
  async summary(c: TenantContext) {
    return withTenant(this.p, c, async (tx, t) => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      let users = c.role === 'WORKER' ? [c.userId] : undefined;
      if (c.role === 'MANAGER') {
        const memberships = await tx.teamMember.findMany({
          where: { companyId: t.companyId, userId: c.userId, isManager: true },
          select: {
            team: { select: { members: { select: { userId: true } } } },
          },
        });
        users = [
          ...new Set(
            memberships.flatMap((x) => x.team.members.map((y) => y.userId)),
          ),
        ];
      }
      const scope = users ? { userId: { in: users } } : {};
      const entries = await tx.workEntry.findMany({
        where: {
          companyId: t.companyId,
          ...scope,
          date: today,
        },
      });
      const pending = await tx.workEntry.count({
        where: {
          companyId: t.companyId,
          ...scope,
          status: 'SUBMITTED',
        },
      });
      const totalMinutes = entries.reduce((n, e) => n + e.workedMinutes, 0);
      const anomalies = entries.filter((e) => e.differenceMinutes !== 0).length;
      const activeUsers = await tx.user.count({
        where: {
          companyId: t.companyId,
          active: true,
          userId: undefined,
        } as never,
      });
      const encoded = new Set(entries.map((e) => e.userId)).size;
      const balanceRows = await tx.timeBalanceTransaction.findMany({
        where: {
          companyId: t.companyId,
          ...scope,
        },
      });
      return {
        entries,
        pending,
        totalMinutes,
        missing: Math.max(0, activeUsers - encoded),
        anomalies,
        balanceMinutes: balanceRows.reduce((n, x) => n + x.minutes, 0),
      };
    });
  }
}
