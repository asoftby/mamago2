import { createHash } from "node:crypto";

import { PrismaClient } from "@prisma/client";

import { executeCleanUserBatch, previewCleanUserManifest, readCleanUserManifest, validateCleanUserManifest } from "../src/lib/migration/commit/user";
import { assertLocalDatabaseUrl } from "./migration-user-vertical-slice";

type Counts = { user: number; session: number; token: number; business: number; place: number; offer: number; article: number; route: number; media: number; lineage: number; record: number };
type Audit = { counts: Counts; forbiddenFingerprint: string; duplicateEmails: number; duplicateLineage: number };

function digest(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

async function captureAudit(prisma: PrismaClient): Promise<Audit> {
  const [business, place, offer, article, route, protectedUsers, duplicateEmails, duplicateLineage] = await Promise.all([
    prisma.business.findMany({ orderBy: { id: "asc" }, select: { id: true, ownerUserId: true } }),
    prisma.place.findMany({ orderBy: { id: "asc" }, select: { id: true, ownerBusinessId: true, createdByUserId: true } }),
    prisma.offer.findMany({ orderBy: { id: "asc" }, select: { id: true, placeId: true } }),
    prisma.article.findMany({ orderBy: { id: "asc" }, select: { id: true, authorUserId: true } }),
    prisma.route.findMany({ orderBy: { id: "asc" }, select: { id: true, authorId: true } }),
    prisma.user.findMany({ where: { OR: [{ role: { in: ["ADMIN", "MODERATOR", "BUSINESS_OWNER"] } }, { status: "ACTIVE" }] }, orderBy: { id: "asc" }, select: { id: true, role: true, status: true, passwordHash: true, emailVerifiedAt: true, deletedAt: true } }),
    prisma.$queryRaw<Array<{ count: bigint }>>`select count(*) as count from (select lower(trim(email)) from "User" group by lower(trim(email)) having count(*) > 1) d`,
    prisma.$queryRaw<Array<{ count: bigint }>>`select count(*) as count from (select "sourceId", "sourceRecordKey", "targetType", "targetRole" from "MigrationLineage" where "isActive" = true group by 1,2,3,4 having count(*) > 1) d`,
  ]);
  const counts: Counts = {
    user: await prisma.user.count(), session: await prisma.session.count(), token: await prisma.userActionToken.count(), business: business.length,
    place: place.length, offer: offer.length, article: article.length, route: route.length, media: await prisma.mediaAsset.count(),
    lineage: await prisma.migrationLineage.count(), record: await prisma.migrationRecord.count(),
  };
  return { counts, forbiddenFingerprint: digest({ business, place, offer, article, route, protectedUsers }), duplicateEmails: Number(duplicateEmails[0]?.count ?? 0), duplicateLineage: Number(duplicateLineage[0]?.count ?? 0) };
}

function parseArgs(argv: readonly string[]) {
  const entityIndex = argv.indexOf("--entity");
  const manifestIndex = argv.indexOf("--manifest");
  const sizeIndex = argv.indexOf("--batch-size");
  const phaseIndex = argv.indexOf("--phase");
  const rootIndex = argv.indexOf("--snapshot-root");
  if (entityIndex < 0 || argv[entityIndex + 1] !== "user") throw new Error("Batch requires --entity user.");
  if (manifestIndex < 0 || !argv[manifestIndex + 1]) throw new Error("Batch requires --manifest.");
  if (Number(argv[sizeIndex + 1]) !== 50) throw new Error("Batch size must be exactly 50.");
  const preview = argv.includes("--preview");
  const commit = argv.includes("--commit");
  if (preview === commit) throw new Error("Choose exactly one of --preview or --commit.");
  const phase = argv[phaseIndex + 1] === "rerun" ? "RERUN" as const : argv[phaseIndex + 1] === "first" ? "FIRST_RUN" as const : null;
  if (!phase) throw new Error("Batch requires --phase first|rerun.");
  return { manifestPath: argv[manifestIndex + 1], snapshotRoot: rootIndex >= 0 ? argv[rootIndex + 1] : "/tmp/scratchpad/users", preview, phase };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertLocalDatabaseUrl(process.env.DATABASE_URL);
  const manifest = readCleanUserManifest(args.manifestPath);
  const validation = validateCleanUserManifest(manifest, args.snapshotRoot);
  console.log(JSON.stringify({ manifest: validation, mode: args.preview ? "PREVIEW" : "COMMIT", phase: args.phase }));
  const prisma = new PrismaClient();
  try {
    if (args.preview) {
      const summary = await previewCleanUserManifest(prisma, manifest, args.snapshotRoot, args.phase);
      console.log(JSON.stringify({ total: summary.total, create: summary.create, skipUnchanged: summary.skipUnchanged, blocked: summary.blocked, error: summary.error, ownershipActions: 0, mediaActions: 0, emailActions: 0, activationTokenActions: 0 }));
      return;
    }
    const baseline = await captureAudit(prisma);
    const summary = await executeCleanUserBatch({ prisma, manifest, snapshotRoot: args.snapshotRoot, phase: args.phase, afterBatch: async state => {
      const audit = await captureAudit(prisma);
      const creates = state.results.filter(result => result.action === "CREATE").length;
      if (audit.counts.user - baseline.counts.user !== creates || audit.counts.lineage - baseline.counts.lineage !== creates || audit.counts.record - baseline.counts.record !== state.processed) throw new Error(`BATCH_AUDIT_DELTA_MISMATCH:${state.batchNumber}`);
      for (const key of ["session", "token", "business", "place", "offer", "article", "route", "media"] as const) if (audit.counts[key] !== baseline.counts[key]) throw new Error(`BATCH_AUDIT_FORBIDDEN_DELTA:${key}:${state.batchNumber}`);
      if (audit.forbiddenFingerprint !== baseline.forbiddenFingerprint || audit.duplicateEmails !== 0 || audit.duplicateLineage !== 0) throw new Error(`BATCH_AUDIT_FORBIDDEN_MUTATION:${state.batchNumber}`);
      console.log(JSON.stringify({ batch: state.batchNumber, processed: state.processed, create: creates, skipUnchanged: state.processed - creates, cumulativeDeltas: { User: creates, MigrationLineage: creates, MigrationRecord: state.processed, Session: 0, UserActionToken: 0, ownership: 0, media: 0 } }));
    } });
    console.log(JSON.stringify({ complete: true, total: summary.total, create: summary.create, skipUnchanged: summary.skipUnchanged, blocked: summary.blocked, error: summary.error, completedBatches: summary.completedBatches }));
  } finally { await prisma.$disconnect(); }
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
