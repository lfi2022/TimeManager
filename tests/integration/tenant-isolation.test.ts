import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createTenantContextFromIdentity } from '../../backend/src/tenancy/context.js';
import { withTenant } from '../../backend/src/tenancy/tenant-prisma.js';
import { TenantCompaniesRepository } from '../../backend/src/modules/companies/tenant-companies.repository.js';
import { TenantUsersRepository } from '../../backend/src/modules/users/tenant-users.repository.js';

const appUrl = process.env.DATABASE_URL;
const migratorUrl = process.env.DATABASE_MIGRATOR_URL;
if (!appUrl || !migratorUrl)
  throw new Error('Integration database URLs are required.');

const app = new PrismaClient({ datasources: { db: { url: appUrl } } });
const migrator = new PrismaClient({
  datasources: { db: { url: migratorUrl } },
});

let companyA: { id: string };
let companyB: { id: string };
let workerA: { id: string };
let workerB: { id: string };
let contextA: ReturnType<typeof createTenantContextFromIdentity>;
let contextB: ReturnType<typeof createTenantContextFromIdentity>;

beforeAll(async () => {
  companyA = await migrator.company.findUniqueOrThrow({
    where: { slug: 'secret-company-a' },
  });
  companyB = await migrator.company.findUniqueOrThrow({
    where: { slug: 'secret-company-b' },
  });
  workerA = await migrator.user.findUniqueOrThrow({
    where: {
      companyId_email: {
        companyId: companyA.id,
        email: 'worker-a@tempopoint.test',
      },
    },
  });
  workerB = await migrator.user.findUniqueOrThrow({
    where: {
      companyId_email: {
        companyId: companyB.id,
        email: 'worker-b@tempopoint.test',
      },
    },
  });
  contextA = createTenantContextFromIdentity({
    companyId: companyA.id,
    userId: workerA.id,
    role: 'WORKER',
  });
  contextB = createTenantContextFromIdentity({
    companyId: companyB.id,
    userId: workerB.id,
    role: 'WORKER',
  });
});

afterAll(async () => {
  await Promise.all([app.$disconnect(), migrator.$disconnect()]);
});

describe('RLS tenant isolation', () => {
  it('fails closed without a tenant context, including unfiltered Prisma queries', async () => {
    expect(await app.company.findMany()).toEqual([]);
    expect(await app.user.findMany()).toEqual([]);
    expect(
      await app.$queryRaw<
        { companyId: string }[]
      >`SELECT "companyId" FROM "User"`,
    ).toEqual([]);
  });

  it('keeps company A and B strictly separated in both directions', async () => {
    const users = new TenantUsersRepository(app);
    const companies = new TenantCompaniesRepository(app);
    const [aUsers, bUsers, aCompany, bCompany] = await Promise.all([
      users.list(contextA),
      users.list(contextB),
      companies.current(contextA),
      companies.current(contextB),
    ]);
    expect(aUsers).toHaveLength(3);
    expect(aUsers.every((user) => user.companyId === companyA.id)).toBe(true);
    expect(aUsers.map((user) => user.email)).not.toContain(
      'worker-b@tempopoint.test',
    );
    expect(bUsers).toHaveLength(3);
    expect(bUsers.every((user) => user.companyId === companyB.id)).toBe(true);
    expect(bUsers.map((user) => user.email)).not.toContain(
      'worker-a@tempopoint.test',
    );
    expect(aCompany?.name).toBe('SECRET-COMPANY-A');
    expect(bCompany?.name).toBe('SECRET-COMPANY-B');
  });

  it('refuses direct foreign IDs and preserves non-disclosure', async () => {
    const users = new TenantUsersRepository(app);
    await expect(users.findById(contextA, workerB.id)).resolves.toBeNull();
    await expect(users.findById(contextB, workerA.id)).resolves.toBeNull();
  });

  it('rejects a manipulated companyId and derives tenant ownership server-side', async () => {
    const users = new TenantUsersRepository(app);
    await expect(
      users.create(contextA, {
        email: 'manipulated@tempopoint.test',
        passwordHash: 'test-hash',
        firstName: 'Manipulated',
        lastName: 'Input',
        role: 'WORKER',
        companyId: companyB.id,
      } as unknown as Parameters<typeof users.create>[1]),
    ).rejects.toThrow();

    const created = await users.create(contextA, {
      email: 'created-in-a@tempopoint.test',
      passwordHash: 'test-hash',
      firstName: 'Created',
      lastName: 'A',
      role: 'WORKER',
    });
    expect(created.companyId).toBe(companyA.id);
    expect(await users.findById(contextB, created.id)).toBeNull();
  });

  it('requires a server tenant context before issuing a tenant transaction', async () => {
    await expect(withTenant(app, undefined, async () => true)).rejects.toThrow(
      'Tenant context is required',
    );
  });
});
