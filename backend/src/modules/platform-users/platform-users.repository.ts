import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const createPlatformUserSchema = z
  .object({
    email: z.string().email().max(320),
    passwordHash: z.string().min(1),
  })
  .strict();

export class PlatformUsersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: z.input<typeof createPlatformUserSchema>) {
    return this.prisma.platformUser.create({
      data: createPlatformUserSchema.parse(input),
    });
  }
}
