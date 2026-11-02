/**
 * Issue #1064 — strict read-only preview of FIVE founder-excluded WordPress users.
 *
 * Source: local 2026-07-03 WordPress TSV archive, parsed in memory by the
 * Python launcher and delivered through stdin. No PII or DB credentials
 * are printed, no database writes and no activation emails.
 *
 * This script deliberately has NO COMMIT MODE.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

import {
  maskEmail,
  normalizeUserCandidate,
  normalizeUserEmail,
  planUserMigration,
  type UserSourceCandidate,
} from "../src/lib/migration/commit/user/UserMigrationVerticalSlice";
import { readFounderExclusionKeys } from "../src/lib/migration/commit/user/liveWordPressUserSource";
import {
  assertMigrationDatabaseTarget,
  parseMigrationDatabaseUrl,
  DEV_DATABASE_NAME,
} from "../src/lib/migration/runtime/migrationDatabaseTarget";

export const FIVE_WORDPRESS_SOURCE_KEYS = [
  "wordpress-db:user:7",
  "wordpress-db:user:17",
  "wordpress-db:user:22",
  "wordpress-db:user:42",
  "wordpress-db:user:43",
] as const;
const SOURCE_NAMESPACE = "wordpress-audit-20260703-recovery-1064";
const HEX_64 = /^[0-9a-f]{64}$/;

type RawUser = {
  sourceRecordKey: string;
  email: string;
  displayName: string;
};

type SourceInput = {
  archiveSha256: string;
  sourceRecords: RawUser[];
};

export function requirePreviewOnly(argv: readonly string[]): void {
  if (argv.length !== 2 ||
      argv[0] !== "--preview" ||
      argv[1] !== "--confirm-production") {
    throw new Error("READ_ONLY_FIVE_USER_PREVIEW_ONLY");
  }
}

export function parseFiveUserSource(input: unknown): SourceInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("INVALID_ARCHIVE_SOURCE_INPUT");
  }
  const source = input as Record<string, unknown>;
  if (Object.keys(source).sort().join(",") !== "archiveSha256,sourceRecords" ||
      typeof source.archiveSha256 !== "string" ||
      !HEX_64.test(source.archiveSha256) ||
      !Array.isArray(source.sourceRecords) ||
      source.sourceRecords.length !== FIVE_WORDPRESS_SOURCE_KEYS.length) {
    throw new Error("INVALID_ARCHIVE_SOURCE_INPUT");
  }
  const normalized: RawUser[] = source.sourceRecords.map((record: unknown, index: number) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error("INVALID_ARCHIVE_USER_ROW");
    }
    const row = record as Record<string, unknown>;
    if (Object.keys(row).sort().join(",") !== "displayName,email,sourceRecordKey" ||
        row.sourceRecordKey !== FIVE_WORDPRESS_SOURCE_KEYS[index] ||
        typeof row.email !== "string" ||
        typeof row.displayName !== "string" ||
        row.displayName.trim().length === 0 ||
        row.displayName.length > 300 ||
        !normalizeUserEmail(row.email) ||
        row.email.length > 254) {
      throw new Error("INVALID_ARCHIVE_USER_ROW");
    }
    return {
      sourceRecordKey: row.sourceRecordKey,
      email: row.email,
      displayName: row.displayName,
    };
  });
  const distinctEmails = new Set(normalized.map(row => normalizeUserEmail(row.email)));
  if (distinctEmails.size !== FIVE_WORDPRESS_SOURCE_KEYS.length) {
    throw new Error("DUPLICATE_ARCHIVE_NORMALIZED_EMAIL");
  }
  return { archiveSha256: source.archiveSha256, sourceRecords: normalized };
}

async function readInputFromStdin(): Promise<SourceInput> {
  const buffers: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += data.length;
    if (size > 20_000) throw new Error("ARCHIVE_SOURCE_PIPE_TOO_LARGE");
    buffers.push(data);
  }
  if (!size) throw new Error("MISSING_PRIVATE_ARCHIVE_SOURCE_PIPE");
  try {
    return parseFiveUserSource(JSON.parse(Buffer.concat(buffers).toString("utf8")));
  } catch {
    throw new Error("INVALID_PRIVATE_ARCHIVE_SOURCE_PIPE");
  }
}

function sourceCandidate(source: SourceInput, row: RawUser): UserSourceCandidate {
  const id = Number(row.sourceRecordKey.slice("wordpress-db:user:".length));
  const normalizedEmail = normalizeUserEmail(row.email);
  if (!normalizedEmail) throw new Error("INVALID_ARCHIVE_USER_EMAIL");
  const sourceHash = createHash("sha256")
    .update(JSON.stringify({
      archiveSha256: source.archiveSha256,
      sourceRecordKey: row.sourceRecordKey,
      email: normalizedEmail,
      displayName: row.displayName,
    }))
    .digest("hex");
  return {
    sourceRecordKey: row.sourceRecordKey as UserSourceCandidate["sourceRecordKey"],
    sourceSystem: "wordpress-db",
    legacyUserId: id,
    email: normalizedEmail,
    displayName: row.displayName.trim(),
    firstName: null,
    lastName: null,
    phone: null,
    sourceCreatedAt: null,
    legacyRoles: [],
    legacyPasswordPresent: false,
    businessLinked: false,
    businessEvidence: { exactOwnership: false, placeCount: 0 },
    privilegedCollision: false,
    profileMediaReferencePresent: false,
    sourceHash,
  };
}

async function checkDevUser43(dev: PrismaClient, email: string): Promise<void> {
  const lineages = await dev.migrationLineage.findMany({
    where: { sourceRecordKey: "wordpress-db:user:43", targetType: "USER", isActive: true },
    select: {
      targetId: true,
      source: { select: { adapterKey: true, sourceNamespace: true } },
    },
  });
  if (lineages.length !== 1 ||
      lineages[0].source.adapterKey !== "wordpress-db" ||
      lineages[0].source.sourceNamespace !== "phoenix-release-bundle" ||
      !lineages[0].targetId) {
    throw new Error("HISTORICAL_USER_43_DEV_LINEAGE_CHANGED");
  }
  const user = await dev.user.findUnique({
    where: { id: lineages[0].targetId },
    select: { email: true, deletedAt: true, status: true, role: true },
  });
  if (!user || user.deletedAt ||
      user.status !== "PENDING_ACTIVATION" ||
      user.role !== "BUSINESS_OWNER" ||
      normalizeUserEmail(user.email) !== email) {
    throw new Error("HISTORICAL_USER_43_DEV_EMAIL_CHANGED");
  }
}

async function main(): Promise<void> {
  requirePreviewOnly(process.argv.slice(2));
  const input = await readInputFromStdin();
  const excluded = readFounderExclusionKeys();
  for (const key of FIVE_WORDPRESS_SOURCE_KEYS) {
    if (!excluded.has(key)) throw new Error("WORDPRESS_FOUNDER_EXCLUSION_SCOPE_CHANGED");
  }
  const historic = JSON.parse(readFileSync(
    "docs/migration/users-production-activation-manifest.json", "utf8",
  )) as { entries: Array<{ sourceRecordKey: string; emailMask: string }> };
  const masks = new Map(historic.entries.map(row => [row.sourceRecordKey, row.emailMask]));

  const sourceUrl = process.env.SOURCE_DEV_DATABASE_URL;
  const targetUrl = process.env.DATABASE_URL;
  if (!sourceUrl || !targetUrl) {
    throw new Error("SSH_PREVIEW_DATABASE_URLS_REQUIRED");
  }
  if (parseMigrationDatabaseUrl(sourceUrl).database !== DEV_DATABASE_NAME) {
    throw new Error("DEV_DATABASE_NAME_MISMATCH");
  }

  const dev = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
  const prod = new PrismaClient();
  try {
    const [devDb, prodDb] = await Promise.all([
      dev.$queryRawUnsafe<Array<{ current_database: string }>>("SELECT current_database()"),
      prod.$queryRawUnsafe<Array<{ current_database: string }>>("SELECT current_database()"),
    ]);
    if (devDb[0]?.current_database !== "devmamago") {
      throw new Error("DEV_CURRENT_DATABASE_MISMATCH");
    }
    assertMigrationDatabaseTarget({
      databaseUrl: targetUrl,
      currentDatabase: prodDb[0]?.current_database,
      confirmProduction: true,
      confirmWrites: false,
      acknowledgeProdUserImport: false,
      requireProdUserAcknowledgement: true,
    });

    const results: Array<{
      sourceRecordKey: string; action: string; reason: string | null;
      emailMask: string | null; canonicalHash: string; sourceHash: string;
    }> = [];
    for (const raw of input.sourceRecords) {
      const source = sourceCandidate(input, raw);
      const email = normalizeUserEmail(source.email);
      if (!email || masks.get(source.sourceRecordKey)?.toLowerCase() !==
          maskEmail(email)?.toLowerCase()) {
        throw new Error("ARCHIVE_ACTIVATION_MASK_MISMATCH");
      }
      if (source.sourceRecordKey === "wordpress-db:user:43") {
        await checkDevUser43(dev, email);
      }
      const candidate = normalizeUserCandidate(source);
      const plan = await planUserMigration(prod, candidate, SOURCE_NAMESPACE);
      const historicLineages = await prod.migrationLineage.findMany({
        where: { sourceRecordKey: source.sourceRecordKey, targetType: "USER" },
        select: { isActive: true, source: { select: { adapterKey: true } } },
      });
      const collisions = await prod.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT "id" FROM "User" WHERE lower(btrim("email")) = $1 LIMIT 2',
        email,
      );
      const blocked =
        plan.action !== "CREATE" ||
        historicLineages.length > 0 ||
        collisions.length > 0;
      results.push({
        sourceRecordKey: source.sourceRecordKey,
        action: blocked ? "BLOCKED" : "CREATE",
        reason: plan.action !== "CREATE" ? plan.reason :
          historicLineages.length ? "EXISTING_USER_LINEAGE" :
          collisions.length ? "EXISTING_USER_EMAIL" : null,
        emailMask: maskEmail(email),
        canonicalHash: plan.canonicalHash,
        sourceHash: source.sourceHash,
      });
    }
    console.log(JSON.stringify({
      mode: "PREVIEW_ONLY",
      source: "local-wordpress-archive-2026-07-03",
      archiveSha256: input.archiveSha256,
      sourceNamespacePlanned: SOURCE_NAMESPACE,
      sourceDatabase: "devmamago",
      targetDatabase: "prodmamago",
      expectedRole: "USER",
      expectedStatus: "PENDING_ACTIVATION",
      passwordTransferred: false,
      businessTransferred: false,
      eventTransferred: false,
      emailsSent: 0,
      results,
    }, null, 2));
    if (results.some(row => row.action !== "CREATE")) {
      throw new Error("FIVE_USER_PREVIEW_BLOCKED_REVIEW_REQUIRED");
    }
    console.log("PASS: five source users eligible for separate write-path review; NO WRITES");
  } finally {
    await Promise.all([dev.$disconnect(), prod.$disconnect()]);
  }
}

if (process.argv[1]?.endsWith("migration-wordpress-five-preview.ts")) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : "PREVIEW_FAILED");
    process.exitCode = 1;
  });
}
