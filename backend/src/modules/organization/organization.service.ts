import type { CompanyRole, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireRole } from '../../security/authorization.js';
import { hashPassword } from '../../security/password.js';
import type { TenantContext } from '../../tenancy/context.js';
import { withCompanyId, withTenant } from '../../tenancy/tenant-prisma.js';
import { AuditService } from '../audit/audit.service.js';

const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).nullable().optional();
export const companyInput = z
  .object({
    name: z.string().trim().min(1).max(160),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(100),
    timezone: z.string().trim().min(1).max(100).default('Europe/Brussels'),
    locale: z.string().trim().min(1).max(35).default('fr-BE'),
  })
  .strict();
export const companyPatch = companyInput
  .partial()
  .extend({ active: z.boolean().optional() })
  .strict();
export const userInput = z
  .object({
    email: z.string().email().max(320),
    password: z.string().min(12).max(1024),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    role: z.enum(['ADMIN', 'MANAGER', 'WORKER']),
    employeeNumber: optionalText(100),
    phone: optionalText(50),
    timezone: optionalText(100),
    locale: optionalText(35),
  })
  .strict();
export const userPatch = userInput
  .omit({ password: true })
  .partial()
  .extend({
    password: z.string().min(12).max(1024).optional(),
    active: z.boolean().optional(),
  })
  .strict();
export const teamInput = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: optionalText(1000),
    active: z.boolean().optional(),
  })
  .strict();
export const memberInput = z
  .object({ userId: z.string().uuid(), isManager: z.boolean().default(false) })
  .strict();

type PlatformCompany = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  timezone: string;
  locale: string;
  createdAt: Date;
  updatedAt: Date;
};
function cleanOptional(value: string | null | undefined) {
  return value === undefined ? undefined : value;
}

export class OrganizationService {
  private readonly auditService: AuditService;
  constructor(private readonly prisma: PrismaClient) { this.auditService = new AuditService(prisma); }

  private async audit(companyId: string, event: { action: string; entityType: string; entityId?: string; actorUserId?: string; platformUserId?: string; metadata?: object }) {
    await this.auditService.recordPlatform(companyId, event);
  }

  async platformCompanies() {
    return this.prisma.$queryRawUnsafe<PlatformCompany[]>(
      'SELECT * FROM "platform_list_companies"()',
    );
  }
  async createCompany(platformUserId: string, input: unknown) {
    const data = companyInput.parse(input);
    const rows = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      'SELECT "platform_create_company"($1, $2, $3, $4) AS id',
      data.name,
      data.slug,
      data.timezone,
      data.locale,
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('Company creation failed.');
    await this.audit(id, {
      action: 'COMPANY_CREATED',
      entityType: 'Company',
      entityId: id,
      platformUserId,
      metadata: { slug: data.slug },
    });
    return (await this.platformCompanies()).find(
      (company) => company.id === id,
    )!;
  }
  async updateCompany(platformUserId: string, id: string, input: unknown) {
    const current = (await this.platformCompanies()).find(
      (company) => company.id === id,
    );
    if (!current) return null;
    const patch = companyPatch.parse(input);
    const next = { ...current, ...patch };
    const rows = await this.prisma.$queryRawUnsafe<{ updated: boolean }[]>(
      'SELECT "platform_update_company"($1::uuid, $2, $3, $4, $5, $6) AS updated',
      id,
      next.name,
      next.slug,
      next.active,
      next.timezone,
      next.locale,
    );
    if (!rows[0]?.updated) return null;
    await this.audit(id, {
      action:
        next.active === current.active
          ? 'COMPANY_UPDATED'
          : next.active
            ? 'COMPANY_ACTIVATED'
            : 'COMPANY_DEACTIVATED',
      entityType: 'Company',
      entityId: id,
      platformUserId,
      metadata: { slug: next.slug },
    });
    return (await this.platformCompanies()).find(
      (company) => company.id === id,
    )!;
  }


  async supportUsers(platformUserId: string, companyId: string) {
    const users = await withCompanyId(this.prisma, companyId, (tx) =>
      tx.user.findMany({
        where: { companyId },
        orderBy: [{ active: 'desc' }, { email: 'asc' }],
        select: { id: true, firstName: true, lastName: true, email: true, role: true, active: true },
      }),
    );
    await this.audit(companyId, {
      action: 'SUPPORT_USERS_VIEWED',
      entityType: 'User',
      platformUserId,
    });
    return users;
  }

  async supportUpdateUser(
    platformUserId: string,
    companyId: string,
    userId: string,
    input: unknown,
  ) {
    const patch = z
      .object({ active: z.boolean().optional(), role: z.enum(['ADMIN', 'MANAGER', 'WORKER']).optional(), password: z.string().min(12).max(1024).optional(), forcePasswordChange: z.boolean().optional() })
      .strict()
      .refine((value) => value.active !== undefined || value.role !== undefined || value.password !== undefined || value.forcePasswordChange !== undefined)
      .parse(input);
    const result = await withCompanyId(this.prisma, companyId, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId, companyId } });
      if (!user) return { kind: 'not-found' as const };
      const active = patch.active ?? user.active;
      const role = patch.role ?? user.role;
      if (user.active && user.role === 'ADMIN' && (!active || role !== 'ADMIN')) {
        const otherAdmins = await tx.user.count({
          where: { companyId, active: true, role: 'ADMIN', id: { not: userId } },
        });
        if (otherAdmins === 0) return { kind: 'last-admin' as const };
      }
      const updated = await tx.user.update({
        where: { id: userId },
        data: { active, role, ...(patch.password ? { passwordHash: await hashPassword(patch.password), forcePasswordChange: patch.forcePasswordChange ?? false } : {}) },
        select: { id: true, firstName: true, lastName: true, email: true, role: true, active: true },
      });
      if (!active || patch.password)
        await tx.userSession.updateMany({
          where: { companyId, userId, invalidatedAt: null },
          data: { invalidatedAt: new Date() },
        });
      return { kind: 'updated' as const, user: updated };
    });
    if (result.kind === 'updated')
      await this.audit(companyId, {
        action: 'SUPPORT_USER_UPDATED',
        entityType: 'User',
        entityId: userId,
        platformUserId,
        metadata: { active: result.user.active, role: result.user.role },
      });
    return result;
  }

  async users(context: TenantContext) {
    requireRole(context, ['ADMIN']);
    return withTenant(this.prisma, context, (tx, tenant) =>
      tx.user.findMany({
        where: { companyId: tenant.companyId },
        orderBy: { email: 'asc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          active: true,
          employeeNumber: true,
          phone: true,
          timezone: true,
          locale: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );
  }
  async user(context: TenantContext, id: string) {
    requireRole(context, ['ADMIN']);
    return withTenant(this.prisma, context, (tx, tenant) =>
      tx.user.findFirst({
        where: { id, companyId: tenant.companyId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          active: true,
          employeeNumber: true,
          phone: true,
          timezone: true,
          locale: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );
  }
  async createUser(context: TenantContext, input: unknown) {
    requireRole(context, ['ADMIN']);
    const data = userInput.parse(input);
    const passwordHash = await hashPassword(data.password);
    const created = await withTenant(this.prisma, context, (tx, tenant) =>
      tx.user.create({
        data: {
          companyId: tenant.companyId,
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          employeeNumber: cleanOptional(data.employeeNumber) ?? null,
          phone: cleanOptional(data.phone) ?? null,
          timezone: cleanOptional(data.timezone) ?? null,
          locale: cleanOptional(data.locale) ?? null,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          active: true,
        },
      }),
    );
    await this.audit(context.companyId, {
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: created.id,
      actorUserId: context.userId,
      metadata: { role: created.role },
    });
    return created;
  }
  async updateUser(context: TenantContext, id: string, input: unknown) {
    requireRole(context, ['ADMIN']);
    const data = userPatch.parse(input);
    const updated = await withTenant(
      this.prisma,
      context,
      async (tx, tenant) => {
        const user = await tx.user.findFirst({
          where: { id, companyId: tenant.companyId },
        });
        if (!user) return null;
        return tx.user.update({
          where: { id },
          data: Object.fromEntries(
            Object.entries({
              email: data.email,
              firstName: data.firstName,
              lastName: data.lastName,
              role: data.role,
              active: data.active,
              passwordHash: data.password
                ? await hashPassword(data.password)
                : undefined,
              employeeNumber: cleanOptional(data.employeeNumber),
              phone: cleanOptional(data.phone),
              timezone: cleanOptional(data.timezone),
              locale: cleanOptional(data.locale),
            }).filter(([, value]) => value !== undefined),
          ),
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            active: true,
          },
        });
      },
    );
    if (updated)
      await this.audit(context.companyId, {
        action: updated.active ? 'USER_UPDATED' : 'USER_DEACTIVATED',
        entityType: 'User',
        entityId: id,
        actorUserId: context.userId,
        metadata: { role: updated.role },
      });
    return updated;
  }
  async deleteUser(context: TenantContext, id: string) {
    return this.updateUser(context, id, { active: false });
  }

  async teams(context: TenantContext) {
    requireRole(context, ['ADMIN']);
    return withTenant(this.prisma, context, (tx, tenant) =>
      tx.team.findMany({
        where: { companyId: tenant.companyId },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
    );
  }
  async createTeam(context: TenantContext, input: unknown) {
    requireRole(context, ['ADMIN']);
    const data = teamInput.parse(input);
    const team = await withTenant(this.prisma, context, (tx, tenant) =>
      tx.team.create({
        data: {
          companyId: tenant.companyId,
          name: data.name,
          description: cleanOptional(data.description) ?? null,
          active: data.active ?? true,
        },
      }),
    );
    await this.audit(context.companyId, {
      action: 'TEAM_CREATED',
      entityType: 'Team',
      entityId: team.id,
      actorUserId: context.userId,
    });
    return team;
  }
  async updateTeam(context: TenantContext, id: string, input: unknown) {
    requireRole(context, ['ADMIN']);
    const data = teamInput.partial().parse(input);
    const team = await withTenant(this.prisma, context, async (tx, tenant) => {
      const exists = await tx.team.findFirst({
        where: { id, companyId: tenant.companyId },
      });
      return exists
        ? tx.team.update({
            where: { id },
            data: Object.fromEntries(
              Object.entries({
                name: data.name,
                active: data.active,
                description: cleanOptional(data.description),
              }).filter(([, value]) => value !== undefined),
            ),
          })
        : null;
    });
    if (team)
      await this.audit(context.companyId, {
        action: 'TEAM_UPDATED',
        entityType: 'Team',
        entityId: id,
        actorUserId: context.userId,
      });
    return team;
  }
  async deleteTeam(context: TenantContext, id: string) {
    requireRole(context, ['ADMIN']);
    const removed = await withTenant(
      this.prisma,
      context,
      async (tx, tenant) => {
        const exists = await tx.team.findFirst({
          where: { id, companyId: tenant.companyId },
        });
        if (!exists) return false;
        await tx.team.delete({ where: { id } });
        return true;
      },
    );
    if (removed)
      await this.audit(context.companyId, {
        action: 'TEAM_DELETED',
        entityType: 'Team',
        entityId: id,
        actorUserId: context.userId,
      });
    return removed;
  }
  async addMember(context: TenantContext, teamId: string, input: unknown) {
    requireRole(context, ['ADMIN']);
    const data = memberInput.parse(input);
    const member = await withTenant(
      this.prisma,
      context,
      async (tx, tenant) => {
        const [team, user] = await Promise.all([
          tx.team.findFirst({
            where: { id: teamId, companyId: tenant.companyId },
          }),
          tx.user.findFirst({
            where: { id: data.userId, companyId: tenant.companyId },
          }),
        ]);
        if (!team || !user) return null;
        if (
          data.isManager &&
          !(['ADMIN', 'MANAGER'] as CompanyRole[]).includes(user.role)
        )
          throw new Error('Only a manager can manage a team.');
        return tx.teamMember.upsert({
          where: { teamId_userId: { teamId, userId: data.userId } },
          update: { isManager: data.isManager },
          create: {
            companyId: tenant.companyId,
            teamId,
            userId: data.userId,
            isManager: data.isManager,
          },
        });
      },
    );
    if (member)
      await this.audit(context.companyId, {
        action: member.isManager
          ? 'TEAM_MANAGER_ASSIGNED'
          : 'TEAM_MEMBER_ASSIGNED',
        entityType: 'TeamMember',
        entityId: member.id,
        actorUserId: context.userId,
        metadata: { teamId },
      });
    return member;
  }
  async removeMember(context: TenantContext, teamId: string, userId: string) {
    requireRole(context, ['ADMIN']);
    const removed = await withTenant(
      this.prisma,
      context,
      async (tx, tenant) => {
        const member = await tx.teamMember.findFirst({
          where: { teamId, userId, companyId: tenant.companyId },
        });
        if (!member) return false;
        await tx.teamMember.delete({ where: { id: member.id } });
        return true;
      },
    );
    if (removed)
      await this.audit(context.companyId, {
        action: 'TEAM_MEMBER_REMOVED',
        entityType: 'TeamMember',
        actorUserId: context.userId,
        metadata: { teamId, userId },
      });
    return removed;
  }
}
