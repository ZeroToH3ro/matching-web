import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Optimize DATABASE_URL with connection pooling for Render PostgreSQL
const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;
  if (!url) return url;

  // Add connection pooling parameters if not already present
  const hasPooling = url.includes('connection_limit') || url.includes('pool_timeout');
  if (hasPooling) return url;

  // Optimize for serverless/Next.js with Render PostgreSQL
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}connection_limit=10&pool_timeout=20&connect_timeout=10`;
};

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;