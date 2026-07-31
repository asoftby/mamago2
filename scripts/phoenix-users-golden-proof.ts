import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

import { FrozenUserSourceRepository, createUsersDependencies } from "../src/lib/migration/release/adapters/usersProductionWiring";

const GOLDEN_KEY = "wordpress-db:user:89";
const ARTIFACT_SHA256 = "85015fe3d69d8fc5540bf23eb638e01ebb9342443764be3817b1113ed76db08a";
const SCHEMA = "phoenix_users_golden_20260731";

function schemaUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", SCHEMA);
  return url.toString();
}

async function counts(prisma: PrismaClient): Promise<Record<string, number>> {
  const [user, lineage, record, business, place, offer] = await Promise.all([
    prisma.user.count(), prisma.migrationLineage.count(), prisma.migrationRecord.count(),
    prisma.business.count(), prisma.place.count(), prisma.offer.count(),
  ]);
  return { User: user, MigrationLineage: lineage, MigrationRecord: record, Business: business, Place: place, Offer: offer };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const artifactRoot = process.env.PHOENIX_RELEASE_ARTIFACT_ROOT;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!artifactRoot) throw new Error("PHOENIX_RELEASE_ARTIFACT_ROOT is required");

  const admin = new PrismaClient();
  const existing = await admin.$queryRawUnsafe<Array<{ exists: boolean }>>(`select exists(select 1 from information_schema.schemata where schema_name = '${SCHEMA}')`);
  if (existing[0]?.exists) throw new Error(`Disposable schema already exists: ${SCHEMA}`);
  await admin.$executeRawUnsafe(`create schema "${SCHEMA}"`);
  await admin.$disconnect();

  const isolatedUrl = schemaUrl(databaseUrl);
  try {
    execFileSync("pnpm", ["prisma", "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_URL: isolatedUrl }, stdio: "pipe",
    });
    const prisma = new PrismaClient({ datasources: { db: { url: isolatedUrl } } });
    try {
      const rawSource = FrozenUserSourceRepository.fromEnvironment(ARTIFACT_SHA256);
      const namespace = "phoenix-users-golden";
      const deps = createUsersDependencies(prisma, rawSource, namespace);

      const before = await counts(prisma);
      const firstPlan = await deps.plan({ sourceRecordKey: GOLDEN_KEY });
      if (firstPlan.action !== "CREATE") throw new Error(`Expected CREATE, got ${firstPlan.action}: ${firstPlan.reason}`);
      if (firstPlan.draftRole !== "USER") throw new Error(`Expected draftRole USER, got ${firstPlan.draftRole}`);
      const written = await deps.write({ sourceRecordKey: GOLDEN_KEY }, firstPlan);
      if (written.action !== "CREATE" || !written.targetId) throw new Error("Expected CREATE with targetId");
      const afterFirst = await counts(prisma);

      const createdUser = await prisma.user.findUniqueOrThrow({ where: { id: written.targetId } });
      const passwordAndActivationSafe = createdUser.passwordHash === null && createdUser.status === "PENDING_ACTIVATION" && createdUser.role === "USER" && createdUser.emailVerifiedAt === null;

      const rerunPlan = await deps.plan({ sourceRecordKey: GOLDEN_KEY });
      if (rerunPlan.action !== "SKIP_UNCHANGED") throw new Error(`Expected SKIP_UNCHANGED, got ${rerunPlan.action}: ${rerunPlan.reason}`);
      const afterRerun = await counts(prisma);

      const forbidden = ["Business", "Place", "Offer"];
      const forbiddenUnchanged = forbidden.every((table) => before[table] === afterRerun[table]);
      const report = {
        schema: SCHEMA, artifactSha256: ARTIFACT_SHA256, sourceRecordKey: GOLDEN_KEY,
        firstRun: { plan: firstPlan.action, draftRole: firstPlan.draftRole, userDelta: afterFirst.User - before.User, lineageDelta: afterFirst.MigrationLineage - before.MigrationLineage },
        activationAndSecuritySafe: passwordAndActivationSafe,
        rerun: { plan: rerunPlan.action, create: 0, userCountStable: afterRerun.User === afterFirst.User, lineageCountStable: afterRerun.MigrationLineage === afterFirst.MigrationLineage },
        forbiddenTablesUnchanged: forbiddenUnchanged,
      };
      if (!forbiddenUnchanged || !passwordAndActivationSafe || !report.rerun.userCountStable) throw new Error("Golden proof invariants failed");
      console.log(JSON.stringify(report, null, 2));
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    const cleanup = new PrismaClient();
    await cleanup.$executeRawUnsafe(`drop schema if exists "${SCHEMA}" cascade`);
    await cleanup.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
