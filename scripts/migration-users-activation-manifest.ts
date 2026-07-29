/**
 * Fixed production activation manifest — read-only, zero writes.
 *
 * Scope: every migrated User (active USER-type MigrationLineage under the
 * `users-immutable-snapshot` source, the same source every Users slice —
 * clean 564, business-linked 38, manual/privileged 14 — has written into)
 * that is a real send candidate for the production activation email.
 *
 * This does not send anything and does not decide whether delivery is
 * currently allowed (that's `resolveActivationEmailDelivery()` at request
 * time) — it only fixes, before any production run, exactly who is
 * eligible and why anyone isn't, so a canary/batch run has a frozen,
 * hashed list to work against instead of a live query that could shift
 * between the rehearsal and the real run.
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";

import { normalizeEmail, isValidEmail } from "../src/lib/auth/email";
import { maskEmail } from "../src/lib/migration/commit/user";
import { assertLocalDatabaseUrl } from "./migration-user-vertical-slice";

const OUTPUT_PATH = join(process.cwd(), "docs/migration/users-production-activation-manifest.json");

type ExclusionReason =
  | "NOT_PENDING_ACTIVATION"
  | "SOFT_DELETED"
  | "PRIVILEGED_ROLE_NOT_ACTIVATION_TARGET"
  | "INVALID_EMAIL"
  | "DUPLICATE_EMAIL";

interface ManifestEntry {
  userId: string;
  sourceRecordKey: string;
  emailMask: string;
  role: "USER" | "BUSINESS_OWNER" | "ADMIN" | "MODERATOR";
  eligibility: "ELIGIBLE" | "EXCLUDED";
  exclusionReason: ExclusionReason | null;
  expectedAction: "SEND_ACTIVATION_EMAIL" | "SKIP";
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function main(): Promise<void> {
  assertLocalDatabaseUrl(process.env.DATABASE_URL);
  const prisma = new PrismaClient();
  try {
    const lineageRows = await prisma.migrationLineage.findMany({
      where: { targetType: "USER", isActive: true, sourceRecordKey: { startsWith: "wordpress-db:user:" } },
      select: { sourceRecordKey: true, targetId: true },
    });
    const sourceKeyByUserId = new Map(lineageRows.filter(r => r.targetId).map(r => [r.targetId!, r.sourceRecordKey]));

    const users = await prisma.user.findMany({
      where: { id: { in: [...sourceKeyByUserId.keys()] } },
      select: { id: true, email: true, role: true, status: true, deletedAt: true },
      orderBy: { id: "asc" },
    });

    if (users.length !== sourceKeyByUserId.size) {
      throw new Error(`MANIFEST_INTEGRITY: ${sourceKeyByUserId.size} active USER lineage rows but ${users.length} User rows resolved.`);
    }

    // Duplicate-email defense-in-depth: User.email has a DB-level unique
    // constraint, so this should structurally always come back empty — but
    // "structurally impossible" is not "verified", so check anyway.
    const normalizedCounts = new Map<string, number>();
    for (const user of users) {
      const key = normalizeEmail(user.email);
      normalizedCounts.set(key, (normalizedCounts.get(key) ?? 0) + 1);
    }

    const entries: ManifestEntry[] = users.map(user => {
      const sourceRecordKey = sourceKeyByUserId.get(user.id)!;
      const normalized = normalizeEmail(user.email);
      const role = user.role as ManifestEntry["role"];

      let exclusionReason: ExclusionReason | null = null;
      if (user.deletedAt !== null) exclusionReason = "SOFT_DELETED";
      else if (user.status !== "PENDING_ACTIVATION") exclusionReason = "NOT_PENDING_ACTIVATION";
      else if (role === "ADMIN" || role === "MODERATOR") exclusionReason = "PRIVILEGED_ROLE_NOT_ACTIVATION_TARGET";
      else if (!isValidEmail(user.email)) exclusionReason = "INVALID_EMAIL";
      else if ((normalizedCounts.get(normalized) ?? 0) > 1) exclusionReason = "DUPLICATE_EMAIL";

      return {
        userId: user.id,
        sourceRecordKey,
        emailMask: maskEmail(user.email) ?? "(unmaskable)",
        role,
        eligibility: exclusionReason ? "EXCLUDED" : "ELIGIBLE",
        exclusionReason,
        expectedAction: exclusionReason ? "SKIP" : "SEND_ACTIVATION_EMAIL",
      };
    }).sort((a, b) => (a.sourceRecordKey < b.sourceRecordKey ? -1 : 1));

    const eligibleCount = entries.filter(e => e.eligibility === "ELIGIBLE").length;
    const exclusionCounts = entries.reduce<Record<string, number>>((acc, e) => {
      if (e.exclusionReason) acc[e.exclusionReason] = (acc[e.exclusionReason] ?? 0) + 1;
      return acc;
    }, {});

    const manifestHash = createHash("sha256").update(stable(entries)).digest("hex");

    const manifest = {
      phase: "USERS production activation — fixed eligibility manifest",
      generatedAt: new Date().toISOString(),
      note: "read-only; no email sent building this manifest; excludes ACTIVE ADMIN/MODERATOR, non-PENDING_ACTIVATION, invalid/duplicate email",
      totalMigratedUsers: entries.length,
      eligibleCount,
      exclusionCounts,
      manifestHash,
      entries,
    };

    writeFileSync(OUTPUT_PATH, JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({ path: OUTPUT_PATH, totalMigratedUsers: entries.length, eligibleCount, exclusionCounts, manifestHash }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
