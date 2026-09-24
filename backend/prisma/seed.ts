import { PrismaClient, CompanyRole } from '@prisma/client';

const prisma = new PrismaClient();

const companies = [
  { name: 'SECRET-COMPANY-A', slug: 'secret-company-a' },
  { name: 'SECRET-COMPANY-B', slug: 'secret-company-b' },
] as const;

const users = [
  [
    'secret-company-a',
    'admin-a@tempopoint.test',
    'Admin',
    'A',
    CompanyRole.ADMIN,
  ],
  [
    'secret-company-a',
    'manager-a@tempopoint.test',
    'Manager',
    'A',
    CompanyRole.MANAGER,
  ],
  [
    'secret-company-a',
    'worker-a@tempopoint.test',
    'Worker',
    'A',
    CompanyRole.WORKER,
  ],
  [
    'secret-company-b',
    'admin-b@tempopoint.test',
    'Admin',
    'B',
    CompanyRole.ADMIN,
  ],
  [
    'secret-company-b',
    'manager-b@tempopoint.test',
    'Manager',
    'B',
    CompanyRole.MANAGER,
  ],
  [
    'secret-company-b',
    'worker-b@tempopoint.test',
    'Worker',
    'B',
    CompanyRole.WORKER,
  ],
] as const;

async function main() {
  const companyBySlug = new Map<string, string>();
  for (const company of companies) {
    const record = await prisma.company.upsert({
      where: { slug: company.slug },
      update: {
        name: company.name,
        active: true,
        timezone: 'Europe/Brussels',
        locale: 'fr-BE',
      },
      create: {
        ...company,
        active: true,
        timezone: 'Europe/Brussels',
        locale: 'fr-BE',
      },
    });
    companyBySlug.set(company.slug, record.id);
  }
  for (const [companySlug, email, firstName, lastName, role] of users) {
    const companyId = companyBySlug.get(companySlug);
    if (!companyId) throw new Error('Seed company is missing.');
    await prisma.user.upsert({
      where: { companyId_email: { companyId, email } },
      update: { firstName, lastName, role, active: true },
      create: {
        companyId,
        email,
        firstName,
        lastName,
        role,
        active: true,
        passwordHash: 'development-seed-hash-not-for-authentication',
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    throw error;
  });
