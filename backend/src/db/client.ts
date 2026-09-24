import { PrismaClient } from '@prisma/client';

export function createPrismaClient(databaseUrl?: string) {
  return new PrismaClient(
    databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined,
  );
}
