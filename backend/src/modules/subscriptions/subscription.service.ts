import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { withCompanyId } from '../../tenancy/tenant-prisma.js';
import { AuditService } from '../audit/audit.service.js';

const assignment = z.object({
  planId: z.string().regex(/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/, 'Identifiant de plan invalide.'),
  extraSeats: z.number().int().min(0).max(100_000).optional(),
}).strict();
function includedSeats(limits: unknown) {
  const value = typeof limits === 'object' && limits !== null ? (limits as { activeUsers?: unknown }).activeUsers : undefined;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}
export class SubscriptionService {
  private readonly audit: AuditService;
  constructor(private readonly prisma: PrismaClient) { this.audit = new AuditService(prisma); }
  async plans() { return this.prisma.plan.findMany({ where: { active: true }, orderBy: { name: 'asc' } }); }
  async summary(companyId: string) {
    return withCompanyId(this.prisma, companyId, async tx => {
      const [subscription, activeUsers] = await Promise.all([
        tx.subscription.findUnique({ where: { companyId }, include: { plan: true } }),
        tx.user.count({ where: { companyId, active: true } }),
      ]);
      const included = subscription ? includedSeats(subscription.plan.limits) : 0;
      const extraSeats = subscription?.extraSeats ?? 0;
      return { subscription, activeUsers, includedSeats: included, extraSeats, seatCapacity: included + extraSeats };
    });
  }
  async assign(platformUserId: string, companyId: string, raw: unknown) {
    const data = assignment.parse(raw);
    const plan = await this.prisma.plan.findFirst({ where: { id: data.planId, active: true } });
    if (!plan) return null;
    const subscription = await withCompanyId(this.prisma, companyId, tx => tx.subscription.upsert({
      where: { companyId },
      update: { planId: plan.id, status: 'ACTIVE', suspendedAt: null, ...(data.extraSeats === undefined ? {} : { extraSeats: data.extraSeats }) },
      create: { companyId, planId: plan.id, extraSeats: data.extraSeats ?? 0 },
    }));
    await this.audit.recordPlatform(companyId, { action: 'SUBSCRIPTION_ASSIGNED', entityType: 'Subscription', entityId: subscription.id, platformUserId, metadata: { plan: plan.code, extraSeats: subscription.extraSeats } });
    return subscription;
  }
  async suspend(platformUserId: string, companyId: string, suspended: boolean) {
    const result = await withCompanyId(this.prisma, companyId, async tx => {
      const subscription = await tx.subscription.findUnique({ where: { companyId } });
      return subscription ? tx.subscription.update({ where: { companyId }, data: { status: suspended ? 'SUSPENDED' : 'ACTIVE', suspendedAt: suspended ? new Date() : null } }) : null;
    });
    if (result) await this.audit.recordPlatform(companyId, { action: suspended ? 'SUBSCRIPTION_SUSPENDED' : 'SUBSCRIPTION_REACTIVATED', entityType: 'Subscription', entityId: result.id, platformUserId });
    return result;
  }
  async supportContext(platformUserId: string, companyId: string) { const summary = await this.summary(companyId); await this.audit.recordPlatform(companyId, { action: 'SUPPORT_CONTEXT_SELECTED', entityType: 'Company', entityId: companyId, platformUserId }); return summary; }
}