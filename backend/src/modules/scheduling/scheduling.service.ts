import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireRole } from '../../security/authorization.js';
import type { TenantContext } from '../../tenancy/context.js';
import { withTenant } from '../../tenancy/tenant-prisma.js';
const text = (max: number) =>
  z.string().trim().min(1).max(max).nullable().optional();
const worksite = z
  .object({
    name: z.string().trim().min(1).max(160),
    code: text(50),
    description: text(1000),
    address: text(500),
    active: z.boolean().optional(),
  })
  .strict();
const day = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    expectedMinutes: z.number().int().min(0).max(1440),
    defaultStartTime: text(5),
    defaultEndTime: text(5),
    defaultBreakMinutes: z.number().int().min(0).max(600).nullable().optional(),
  })
  .strict();
const schedule = z
  .object({
    name: z.string().trim().min(1).max(160),
    active: z.boolean().optional(),
    days: z.array(day).max(7),
  })
  .strict()
  .superRefine((v, c) => {
    if (new Set(v.days.map((d) => d.dayOfWeek)).size !== v.days.length)
      c.addIssue({ code: 'custom', message: 'Duplicate day' });
  });
const assignment = z
  .object({
    userId: z.string().uuid(),
    scheduleId: z.string().uuid(),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date().nullable().optional(),
  })
  .strict()
  .refine((v) => !v.validUntil || v.validUntil >= v.validFrom);
const optional = (v: string | null | undefined) =>
  v === undefined ? undefined : v;
export class SchedulingService {
  constructor(private readonly prisma: PrismaClient) {}
  private async audit(
    ctx: TenantContext,
    action: string,
    type: string,
    id: string,
    metadata?: object,
  ) {
    await withTenant(this.prisma, ctx, (tx) =>
      tx.auditEvent.create({
        data: {
          companyId: ctx.companyId,
          actorUserId: ctx.userId,
          action,
          entityType: type,
          entityId: id,
          metadata: (metadata ?? null) as Prisma.InputJsonValue,
        },
      }),
    );
  }
  async worksites(ctx: TenantContext) {
    requireRole(ctx, ['ADMIN']);
    return withTenant(this.prisma, ctx, (tx, t) =>
      tx.worksite.findMany({
        where: { companyId: t.companyId },
        orderBy: { name: 'asc' },
      }),
    );
  }
  async saveWorksite(
    ctx: TenantContext,
    id: string | undefined,
    input: unknown,
  ) {
    requireRole(ctx, ['ADMIN']);
    const d = worksite.parse(input);
    const r = await withTenant(this.prisma, ctx, async (tx, t) => {
      if (!id)
        return tx.worksite.create({
          data: {
            companyId: t.companyId,
            name: d.name,
            code: d.code ?? null,
            description: d.description ?? null,
            address: d.address ?? null,
            active: d.active ?? true,
          },
        });
      const existing = await tx.worksite.findFirst({
        where: { id, companyId: t.companyId },
      });
      return existing
        ? tx.worksite.update({
            where: { id },
            data: Object.fromEntries(
              Object.entries({
                name: d.name,
                code: optional(d.code),
                description: optional(d.description),
                address: optional(d.address),
                active: d.active,
              }).filter(([, value]) => value !== undefined),
            ),
          })
        : null;
    });
    if (r)
      await this.audit(
        ctx,
        id ? 'WORKSITE_UPDATED' : 'WORKSITE_CREATED',
        'Worksite',
        r.id,
      );
    return r;
  }
  async archiveWorksite(ctx: TenantContext, id: string) {
    requireRole(ctx, ['ADMIN']);
    const r = await withTenant(this.prisma, ctx, async (tx, t) => {
      const x = await tx.worksite.findFirst({
        where: { id, companyId: t.companyId },
      });
      return x
        ? tx.worksite.update({ where: { id }, data: { active: false } })
        : null;
    });
    if (r) await this.audit(ctx, 'WORKSITE_ARCHIVED', 'Worksite', id);
    return r;
  }
  async schedules(ctx: TenantContext) {
    requireRole(ctx, ['ADMIN']);
    return withTenant(this.prisma, ctx, (tx, t) =>
      tx.schedule.findMany({
        where: { companyId: t.companyId },
        include: { days: { orderBy: { dayOfWeek: 'asc' } } },
        orderBy: { name: 'asc' },
      }),
    );
  }
  async saveSchedule(
    ctx: TenantContext,
    id: string | undefined,
    input: unknown,
  ) {
    requireRole(ctx, ['ADMIN']);
    const d = schedule.parse(input);
    const weeklyMinutes = d.days.reduce((n, x) => n + x.expectedMinutes, 0);
    const makeDays = (companyId: string) =>
      d.days.map((x) => ({
        companyId,
        dayOfWeek: x.dayOfWeek,
        expectedMinutes: x.expectedMinutes,
        defaultStartTime: x.defaultStartTime ?? null,
        defaultEndTime: x.defaultEndTime ?? null,
        defaultBreakMinutes: x.defaultBreakMinutes ?? null,
      }));
    const r = await withTenant(this.prisma, ctx, async (tx, t) => {
      if (!id)
        return tx.schedule.create({
          data: {
            companyId: t.companyId,
            name: d.name,
            active: d.active ?? true,
            weeklyMinutes,
            days: { create: makeDays(t.companyId) },
          },
          include: { days: true },
        });
      const existing = await tx.schedule.findFirst({
        where: { id, companyId: t.companyId },
      });
      if (!existing) return null;
      await tx.scheduleDay.deleteMany({ where: { scheduleId: id } });
      return tx.schedule.update({
        where: { id },
        data: {
          name: d.name,
          active: d.active ?? existing.active,
          weeklyMinutes,
          days: { create: makeDays(t.companyId) },
        },
        include: { days: true },
      });
    });
    if (r)
      await this.audit(
        ctx,
        id ? 'SCHEDULE_UPDATED' : 'SCHEDULE_CREATED',
        'Schedule',
        r.id,
        { weeklyMinutes },
      );
    return r;
  }
  async assign(ctx: TenantContext, input: unknown) {
    requireRole(ctx, ['ADMIN']);
    const d = assignment.parse(input);
    const r = await withTenant(this.prisma, ctx, async (tx, t) => {
      const [u, s] = await Promise.all([
        tx.user.findFirst({ where: { id: d.userId, companyId: t.companyId } }),
        tx.schedule.findFirst({
          where: { id: d.scheduleId, companyId: t.companyId },
        }),
      ]);
      if (!u || !s) return null;
      return tx.userScheduleAssignment.create({
        data: {
          companyId: t.companyId,
          userId: d.userId,
          scheduleId: d.scheduleId,
          validFrom: d.validFrom,
          validUntil: d.validUntil ?? null,
        },
      });
    });
    if (r)
      await this.audit(
        ctx,
        'USER_SCHEDULE_ASSIGNED',
        'UserScheduleAssignment',
        r.id,
        { userId: d.userId, scheduleId: d.scheduleId },
      );
    return r;
  }
  async expectedMinutes(ctx: TenantContext, userId: string, date: Date) {
    return withTenant(this.prisma, ctx, async (tx, t) => {
      const a = await tx.userScheduleAssignment.findFirst({
        where: {
          companyId: t.companyId,
          userId,
          validFrom: { lte: date },
          OR: [{ validUntil: null }, { validUntil: { gte: date } }],
        },
        orderBy: { validFrom: 'desc' },
        include: { schedule: { include: { days: true } } },
      });
      if (!a) return null;
      const dayOfWeek = (date.getUTCDay() + 6) % 7;
      return {
        minutes:
          a.schedule.days.find((x) => x.dayOfWeek === dayOfWeek)
            ?.expectedMinutes ?? 0,
        timezone: (await tx.company.findFirst({ where: { id: t.companyId } }))
          ?.timezone,
      };
    });
  }
}
