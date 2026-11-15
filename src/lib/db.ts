import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDb(): PrismaClient | null {
  if (!process.env.DATABASE_URL) return null;
  process.env.DIRECT_URL ??= process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  globalForPrisma.prisma ??= new PrismaClient();
  return globalForPrisma.prisma;
}
