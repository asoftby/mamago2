import { defineConfig } from '@prisma/config';

export default defineConfig({
  engine: 'classic',
  // mamaGo uses a domain-split Prisma schema. Keep schema.prisma as the main
  // datasource/generator file and load additional *.prisma model files from
  // the same prisma/ directory.
  schema: 'prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
