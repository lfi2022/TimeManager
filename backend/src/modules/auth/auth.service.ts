import { createHash, randomBytes } from 'node:crypto';
import type { CompanyRole, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { Environment } from '../../config.js';
import { requireRole } from '../../security/authorization.js';
import { hashPassword, verifyPassword } from '../../security/password.js';
import type { TenantContext } from '../../tenancy/context.js';
import { withCompanyId, withTenant } from '../../tenancy/tenant-prisma.js';

const loginSchema = z
  .object({
    companySlug: z.string().trim().min(1).max(100),
    email: z.string().email().max(320),
    password: z.string().min(1).max(1024),
  })
  .strict();
const platformLoginSchema = z
  .object({
    email: z.string().email().max(320),
    password: z.string().min(1).max(1024),
  })
  .strict();
const resetSchema = z
  .object({
    token: z.string().min(32).max(512),
    password: z.string().min(1).max(1024),
  })
  .strict();

type UserIdentity = {
  id: string;
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: CompanyRole;
};
type PlatformIdentity = { id: string; email: string };

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: Environment,
  ) {}

  private tokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
  private expiresAt(minutes: number) {
    return new Date(Date.now() + minutes * 60_000);
  }
  private assertPassword(password: string) {
    if (password.length < this.config.PASSWORD_MIN_LENGTH)
      throw new Error('Password does not meet the configured policy.');
  }
  private newToken() {
    return randomBytes(32).toString('base64url');
  }

  async loginUser(input: unknown) {
    const data = loginSchema.parse(input);
    const companyRows = await this.prisma.$queryRawUnsafe<
      { companyId: string | null }[]
    >('SELECT "auth_company_id_by_slug"($1) AS "companyId"', data.companySlug);
    const companyId = companyRows[0]?.companyId;
    if (!companyId) return null;
    const user = await withCompanyId(this.prisma, companyId, (transaction) =>
      transaction.user.findFirst({
        where: { companyId, email: data.email, active: true },
      }),
    );
    if (!user || !(await verifyPassword(user.passwordHash, data.password)))
      return null;
    const token = this.newToken();
    await withCompanyId(this.prisma, companyId, (transaction) =>
      transaction.userSession.create({
        data: {
          companyId,
          userId: user.id,
          tokenHash: this.tokenHash(token),
          expiresAt: this.expiresAt(this.config.SESSION_TTL_HOURS * 60),
        },
      }),
    );
    await withCompanyId(this.prisma, companyId, (transaction) =>
      transaction.user.update({
        where: { id: user.id },
        data: { lastName: user.lastName },
      }),
    );
    return { token, identity: this.userIdentity(user) };
  }

  async loginPlatform(input: unknown) {
    const data = platformLoginSchema.parse(input);
    const user = await this.prisma.platformUser.findFirst({
      where: { email: data.email, active: true },
    });
    if (!user || !(await verifyPassword(user.passwordHash, data.password)))
      return null;
    const token = this.newToken();
    await this.prisma.platformSession.create({
      data: {
        platformUserId: user.id,
        tokenHash: this.tokenHash(token),
        expiresAt: this.expiresAt(this.config.SESSION_TTL_HOURS * 60),
      },
    });
    await this.prisma.platformUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return {
      token,
      identity: { id: user.id, email: user.email } satisfies PlatformIdentity,
    };
  }

  async userSession(token: string | undefined) {
    if (!token) return null;
    const rows = await this.prisma.$queryRawUnsafe<
      { sessionId: string; companyId: string; userId: string }[]
    >(
      'SELECT * FROM "auth_user_session_by_token_hash"($1)',
      this.tokenHash(token),
    );
    const session = rows[0];
    if (!session) return null;
    return withCompanyId(
      this.prisma,
      session.companyId,
      async (transaction) => {
        const record = await transaction.userSession.findFirst({
          where: {
            id: session.sessionId,
            userId: session.userId,
            invalidatedAt: null,
            expiresAt: { gt: new Date() },
            user: { active: true },
            company: { active: true },
          },
          include: { user: true },
        });
        if (!record) return null;
        await transaction.userSession.update({
          where: { id: record.id },
          data: { lastSeenAt: new Date() },
        });
        return {
          sessionId: record.id,
          identity: this.userIdentity(record.user),
        };
      },
    );
  }

  async platformSession(token: string | undefined) {
    if (!token) return null;
    const record = await this.prisma.platformSession.findFirst({
      where: {
        tokenHash: this.tokenHash(token),
        invalidatedAt: null,
        expiresAt: { gt: new Date() },
        platformUser: { active: true },
      },
      include: { platformUser: true },
    });
    if (!record) return null;
    await this.prisma.platformSession.update({
      where: { id: record.id },
      data: { lastSeenAt: new Date() },
    });
    return {
      sessionId: record.id,
      identity: {
        id: record.platformUser.id,
        email: record.platformUser.email,
      } satisfies PlatformIdentity,
    };
  }

  async logoutUser(token: string | undefined) {
    const current = await this.userSession(token);
    if (current)
      await withCompanyId(
        this.prisma,
        current.identity.companyId,
        (transaction) =>
          transaction.userSession.update({
            where: { id: current.sessionId },
            data: { invalidatedAt: new Date() },
          }),
      );
  }

  async logoutPlatform(token: string | undefined) {
    const current = await this.platformSession(token);
    if (current)
      await this.prisma.platformSession.update({
        where: { id: current.sessionId },
        data: { invalidatedAt: new Date() },
      });
  }

  async issueUserReset(companySlug: string, email: string) {
    const companyRows = await this.prisma.$queryRawUnsafe<
      { companyId: string | null }[]
    >('SELECT "auth_company_id_by_slug"($1) AS "companyId"', companySlug);
    const companyId = companyRows[0]?.companyId;
    if (!companyId) return null;
    const user = await withCompanyId(this.prisma, companyId, (transaction) =>
      transaction.user.findFirst({ where: { companyId, email, active: true } }),
    );
    if (!user) return null;
    const token = this.newToken();
    await withCompanyId(this.prisma, companyId, (transaction) =>
      transaction.userPasswordResetToken.create({
        data: {
          companyId,
          userId: user.id,
          tokenHash: this.tokenHash(token),
          expiresAt: this.expiresAt(this.config.PASSWORD_RESET_TTL_MINUTES),
        },
      }),
    );
    return token;
  }

  async resetUserPassword(input: unknown) {
    const data = resetSchema.parse(input);
    this.assertPassword(data.password);
    const rows = await this.prisma.$queryRawUnsafe<
      { resetId: string; companyId: string; userId: string }[]
    >(
      'SELECT * FROM "auth_user_reset_by_token_hash"($1)',
      this.tokenHash(data.token),
    );
    const reset = rows[0];
    if (!reset) return false;
    return withCompanyId(this.prisma, reset.companyId, async (transaction) => {
      const record = await transaction.userPasswordResetToken.findFirst({
        where: {
          id: reset.resetId,
          userId: reset.userId,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!record) return false;
      await transaction.user.update({
        where: { id: reset.userId },
        data: { passwordHash: await hashPassword(data.password) },
      });
      await transaction.userPasswordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      await transaction.userSession.updateMany({
        where: { userId: reset.userId, invalidatedAt: null },
        data: { invalidatedAt: new Date() },
      });
      return true;
    });
  }

  async deactivateUser(actor: TenantContext, userId: string) {
    requireRole(actor, ['ADMIN']);
    return withTenant(this.prisma, actor, async (transaction) => {
      const user = await transaction.user.findFirst({
        where: { id: userId, companyId: actor.companyId },
      });
      if (!user) return false;
      await transaction.user.update({
        where: { id: user.id },
        data: { active: false },
      });
      await transaction.userSession.updateMany({
        where: { userId: user.id, invalidatedAt: null },
        data: { invalidatedAt: new Date() },
      });
      return true;
    });
  }

  private userIdentity(user: {
    id: string;
    companyId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: CompanyRole;
  }): UserIdentity {
    return {
      id: user.id,
      companyId: user.companyId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  }
}
