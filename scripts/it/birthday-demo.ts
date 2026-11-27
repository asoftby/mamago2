import { assertBirthdayDemoEnvironment } from './birthdayDemo/guard';

async function main() {
  // Refuse BEFORE loading Prisma or touching the database, including cleanup/check.
  assertBirthdayDemoEnvironment(process.env);
  const action = process.argv[2];
  if (!['seed', 'cleanup'].includes(action)) throw new Error('Usage: pnpm birthday:demo seed|cleanup');
  const { PrismaClient } = await import('@prisma/client');
  const { seedBirthdayDemo, cleanupBirthdayDemo } = await import('./birthdayDemo/seed');
  const prisma = new PrismaClient();
  try {
    console.log(JSON.stringify(action === 'seed' ? await seedBirthdayDemo(prisma) : await cleanupBirthdayDemo(prisma), null, 2));
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 2; });
