import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const contents = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function maskDatabaseUrl(databaseUrl) {
  return databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
}

const cwd = process.cwd();
const envPath = path.join(cwd, ".env");
const envFromFile = parseDotEnv(envPath);

for (const [key, value] of Object.entries(envFromFile)) {
  if (!(key in process.env)) {
    process.env[key] = value;
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DB preflight failed: DATABASE_URL is not set.");
  process.exit(1);
}

let parsedUrl;

try {
  parsedUrl = new URL(databaseUrl);
} catch {
  console.error("DB preflight failed: DATABASE_URL is not a valid URL.");
  process.exit(1);
}

const allowedHosts = new Set(["localhost", "127.0.0.1", "::1", "db"]);

if (!allowedHosts.has(parsedUrl.hostname)) {
  console.error(
    `DB preflight failed: refusing to run against non-local host "${parsedUrl.hostname}".`,
  );
  console.error(`DATABASE_URL: ${maskDatabaseUrl(databaseUrl)}`);
  process.exit(1);
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  await prisma.$queryRawUnsafe("SELECT 1");

  const [migrationsResult] = await prisma.$queryRawUnsafe(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = '_prisma_migrations'
    ) AS "hasMigrationsTable"
  `);

  const [tablesResult] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS "appTablesCount"
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'
  `);

  const hasMigrationsTable = Boolean(migrationsResult?.hasMigrationsTable);
  const appTablesCount = Number(tablesResult?.appTablesCount ?? 0);

  if (appTablesCount > 0 && !hasMigrationsTable) {
    console.error(
      "Danger: database has application tables but no _prisma_migrations. Do not run migrate deploy/db push. Recreate local DB or restore migration history.",
    );
    console.error(`DATABASE_URL: ${maskDatabaseUrl(databaseUrl)}`);
    process.exit(1);
  }

  let appliedMigrations = 0;

  if (hasMigrationsTable) {
    const [countResult] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS count
      FROM "_prisma_migrations"
    `);
    appliedMigrations = Number(countResult?.count ?? 0);
  }

  console.log("DB preflight OK");
  console.log(`DATABASE_URL: ${maskDatabaseUrl(databaseUrl)}`);
  console.log(`Application tables: ${appTablesCount}`);
  console.log(`Applied migrations: ${appliedMigrations}`);
} catch (error) {
  console.error("DB preflight failed: could not inspect the local database.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
