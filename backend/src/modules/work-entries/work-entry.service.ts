import type { Prisma, PrismaClient, WorkEntryStatus } from '@prisma/client';
import { z } from 'zod';
import { requireRole } from '../../security/authorization.js';
import type { TenantContext } from '../../tenancy/context.js';
import { withTenant } from '../../tenancy/tenant-prisma.js';
const input = z
  .object({
    userId: z.string().uuid().optional(),
    date: z.coerce.date(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    breakMinutes: z.number().int().min(0).max(720).default(0),
    worksiteId: z.string().uuid().nullable().optional(),
    note: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.endTime <= v.startTime)
      c.addIssue({ code: 'custom', message: 'End must follow start' });
    if (
      v.startTime.toISOString().slice(0, 10) !==
      v.date.toISOString().slice(0, 10)
    )
      c.addIssue({ code: 'custom', message: 'Date mismatch' });
  });
const edit = z
  .object({
    date: z.coerce.date().optional(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    breakMinutes: z.number().int().min(0).max(720).optional(),
    worksiteId: z.string().uuid().nullable().optional(),
    note: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();
function minutes(a: Date, b: Date, br: number) {
  const value = Math.round((b.getTime() - a.getTime()) / 60000) - br;
  if (value < 0) throw new Error('Break exceeds duration');
  return value;
}
export class WorkEntryService {
  constructor(private readonly prisma: PrismaClient) {}
  async audit(c: TenantContext, action: string, id: string, metadata?: object) {
    await withTenant(this.prisma, c, (tx) =>
      tx.auditEvent.create({
        data: {
          companyId: c.companyId,
          actorUserId: c.userId,
          action,
          entityType: 'WorkEntry',
          entityId: id,
          metadata: (metadata ?? null) as Prisma.InputJsonValue,
        },
      }),
    );
  }
  async expected(
    tx: Prisma.TransactionClient,
    companyId: string,
    userId: string,
    date: Date,
  ) {
    const a = await tx.userScheduleAssignment.findFirst({
      where: {
        companyId,
        userId,
        validFrom: { lte: date },
        OR: [{ validUntil: null }, { validUntil: { gte: date } }],
      },
      orderBy: { validFrom: 'desc' },
      include: { schedule: { include: { days: true } } },
    });
    return (
      a?.schedule.days.find((x) => x.dayOfWeek === (date.getUTCDay() + 6) % 7)
        ?.expectedMinutes ?? 0
    );
  }
  async create(c: TenantContext, raw: unknown) {
    const d = input.parse(raw);
    const userId = d.userId ?? c.userId;
    if (c.role === 'WORKER' && userId !== c.userId)
      throw new Error('Forbidden');
    if (c.role === 'MANAGER' && userId !== c.userId)
      throw new Error('Forbidden');
    const r = await withTenant(this.prisma, c, async (tx, t) => {
      const user = await tx.user.findFirst({
        where: { id: userId, companyId: t.companyId },
      });
      const site =
        !d.worksiteId ||
        (await tx.worksite.findFirst({
          where: { id: d.worksiteId, companyId: t.companyId, active: true },
        }));
      if (!user || !site) return null;
      const worked = minutes(d.startTime, d.endTime, d.breakMinutes);
      const expected = await this.expected(tx, t.companyId, userId, d.date);
      return tx.workEntry.create({
        data: {
          companyId: t.companyId,
          userId,
          date: d.date,
          startTime: d.startTime,
          endTime: d.endTime,
          breakMinutes: d.breakMinutes,
          workedMinutes: worked,
          expectedMinutes: expected,
          differenceMinutes: worked - expected,
          worksiteId: d.worksiteId ?? null,
          note: d.note ?? null,
          createdByUserId: c.userId,
          updatedByUserId: c.userId,
          source: c.role === 'ADMIN' ? 'MANAGER' : 'MANUAL',
        },
      });
    });
    if (r) await this.audit(c, 'WORK_ENTRY_CREATED', r.id);
    return r;
  }
  async list(
    c: TenantContext,
    filter: { status?: WorkEntryStatus; userId?: string } = {},
  ) {
    return withTenant(this.prisma, c, async (tx, t) => {
      let users: string[] | undefined;
      if (c.role === 'WORKER') users = [c.userId];
      if (c.role === 'MANAGER') {
        const m = await tx.teamMember.findMany({
          where: { companyId: t.companyId, userId: c.userId, isManager: true },
          select: {
            team: { select: { members: { select: { userId: true } } } },
          },
        });
        users = [
          ...new Set(m.flatMap((x) => x.team.members.map((y) => y.userId))),
        ];
      }
      const where = Object.fromEntries(
        Object.entries({
          companyId: t.companyId,
          userId: users
            ? { in: filter.userId ? [filter.userId] : users }
            : filter.userId,
          status: filter.status,
        }).filter(([, v]) => v !== undefined),
      );
      return tx.workEntry.findMany({
        where,
        include: {
          worksite: true,
          user: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      });
    });
  }
  async update(c: TenantContext, id: string, raw: unknown) {
    const d = edit.parse(raw);
    const r = await withTenant(this.prisma, c, async (tx, t) => {
      const old = await tx.workEntry.findFirst({
        where: { id, companyId: t.companyId },
      });
      if (
        !old ||
        old.status !== 'DRAFT' ||
        (c.role === 'WORKER' && old.userId !== c.userId)
      )
        return null;
      const start = d.startTime ?? old.startTime;
      const end = d.endTime ?? old.endTime;
      const br = d.breakMinutes ?? old.breakMinutes;
      if (!start || !end) return null;
      const worked = minutes(start, end, br);
      const expected = await this.expected(
        tx,
        t.companyId,
        old.userId,
        d.date ?? old.date,
      );
      return tx.workEntry.update({
        where: { id },
        data: Object.fromEntries(
          Object.entries({
            date: d.date,
            startTime: start,
            endTime: end,
            breakMinutes: br,
            workedMinutes: worked,
            expectedMinutes: expected,
            differenceMinutes: worked - expected,
            worksiteId:
              d.worksiteId === undefined ? old.worksiteId : d.worksiteId,
            note: d.note === undefined ? old.note : d.note,
            updatedByUserId: c.userId,
          }).filter(([, v]) => v !== undefined),
        ),
      });
    });
    if (r) await this.audit(c, 'WORK_ENTRY_UPDATED', id);
    return r;
  }
  async submit(c: TenantContext, id: string) {
    const r = await withTenant(this.prisma, c, async (tx, t) => {
      const e = await tx.workEntry.findFirst({
        where: { id, companyId: t.companyId },
      });
      if (
        !e ||
        e.status !== 'DRAFT' ||
        (c.role === 'WORKER' && e.userId !== c.userId)
      )
        return null;
      return tx.workEntry.update({
        where: { id },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
          updatedByUserId: c.userId,
        },
      });
    });
    if (r) await this.audit(c, 'WORK_ENTRY_SUBMITTED', id);
    return r;
  }
  async decide(
    c: TenantContext,
    id: string,
    approve: boolean,
    reason?: string,
  ) {
    requireRole(c, ['ADMIN', 'MANAGER']);
    if (!approve && !reason?.trim())
      throw new Error('Rejection reason required');
    const allowed = await this.list(c, {});
    const entry = allowed.find((x) => x.id === id);
    if (!entry || entry.status !== 'SUBMITTED') return null;
    const r = await withTenant(this.prisma, c, (tx) =>
      tx.workEntry.update({
        where: { id },
        data: approve
          ? {
              status: 'APPROVED',
              approvedAt: new Date(),
              approvedByUserId: c.userId,
            }
          : {
              status: 'REJECTED',
              rejectedAt: new Date(),
              rejectedByUserId: c.userId,
              rejectionReason: reason!.trim(),
            },
      }),
    );
    await this.audit(
      c,
      approve ? 'WORK_ENTRY_APPROVED' : 'WORK_ENTRY_REJECTED',
      id,
    );
    return r;
  }
}
