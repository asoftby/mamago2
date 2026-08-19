#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { normalizeOffer, type NormalizedOfferCandidate } from "../src/lib/migration/adapters/wordpress-db/normalizeOffer";
import { loadOfferSnapshotEnvelope } from "../src/lib/migration/adapters/wordpress-db/loadOfferSnapshotEnvelope";
import type { WordPressOfferBundle } from "../src/lib/migration/adapters/wordpress-db/types";
import { buildOfferCreateDraft } from "../src/lib/migration/commit/offer/buildOfferCreateDraft";
import { hasOnlyOfferTitleWhitespaceDiff } from "../src/lib/migration/commit/offer/OfferCommitRunner";
import type { OfferCommitContext } from "../src/lib/migration/commit/offer/types";
import { getLineageActionForRecord } from "../src/lib/migration/ledger";

function arg(name: string): string | null { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] ?? null : null; }
function codePoints(value: string): string[] { return [...value].map(character => `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`); }

const sourceRecordKey = arg("--source-record-key");
const targetOfferId = arg("--target-offer-id");
if (!sourceRecordKey || !targetOfferId) throw new Error("--source-record-key and --target-offer-id are required");
const snapshotRoot = arg("--snapshot-root") ?? "/tmp/scratchpad/offers";
const contextPath = arg("--context-config");
if (!contextPath) throw new Error("--context-config is required");
const config = JSON.parse(readFileSync(contextPath, "utf8")) as { overridesBySourceRecordKey?: Record<string, { offer?: OfferCommitContext }> };
const context = config.overridesBySourceRecordKey?.[sourceRecordKey]?.offer;
if (!context || context.mediaPolicy !== "NONE") throw new Error("Exact Offer context with mediaPolicy NONE is required.");

const envelope = loadOfferSnapshotEnvelope({ snapshotRoot, sourceRecordKey });
const normalized = normalizeOffer(envelope.rawPayload as WordPressOfferBundle);
const candidate = normalized.normalizedPayload as NormalizedOfferCandidate;
const built = buildOfferCreateDraft({ candidate, context });
if (!built.ok) throw new Error(built.reasons.map(reason => reason.code).join(","));

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
  const [offer, lineages, place] = await Promise.all([
    prisma.offer.findUnique({ where: { id: targetOfferId } }),
    prisma.migrationLineage.findMany({ where: { sourceRecordKey, targetType: "OFFER", isActive: true } }),
    prisma.place.findUnique({ where: { id: context.placeId }, select: { id: true, cityId: true, createdByUserId: true, ownerBusinessId: true, ownerBusiness: { select: { ownerUserId: true } } } }),
  ]);
  if (!offer) throw new Error("Target Offer is missing.");
  if (lineages.length !== 1 || lineages[0].targetId !== targetOfferId) throw new Error("Expected exactly one active lineage pointing to the approved Offer.");
  const approvedOwner = place?.ownerBusiness?.ownerUserId ?? place?.createdByUserId;
  if (!place || place.cityId !== context.cityId || approvedOwner !== context.ownerUserId) throw new Error("Place ownership mapping does not match approved context.");
  if (!lineages[0].lastImportedAt || offer.updatedAt > lineages[0].lastImportedAt) throw new Error("Target Offer was modified after the previous import.");
  if (!hasOnlyOfferTitleWhitespaceDiff(offer, { candidate, context })) throw new Error("Target field diff is not title-only whitespace normalization.");
  if (lineages[0].lastSourceHash === built.canonicalHash) throw new Error("Canonical hash did not change.");
  const action = getLineageActionForRecord({ lineage: lineages, targetType: "OFFER", sourceHash: built.canonicalHash });
  if (action !== "UPDATE") throw new Error(`Phoenix planner returned ${action}, expected UPDATE.`);
  console.log(JSON.stringify({
    mode: "remediation-preview",
    sourceRecordKey,
    action,
    reason: "canonical source hash changed",
    targetOfferId,
    mediaPolicy: context.mediaPolicy,
    ownership: { offerPlaceId: offer.placeId, placeId: place.id, policy: place.ownerBusinessId ? "BUSINESS_OWNER" : "PLACE_CREATED_BY_FALLBACK", ownerUserId: approvedOwner },
    title: { before: offer.title, beforeCodePoints: codePoints(offer.title), after: built.draft.title, afterCodePoints: codePoints(built.draft.title) },
    canonicalHash: { before: lineages[0].lastSourceHash, after: built.canonicalHash },
    fieldDiff: { title: { before: offer.title, after: built.draft.title } },
    cas: { id: offer.id, title: offer.title, updatedAt: offer.updatedAt, placeId: offer.placeId, kind: offer.kind, productType: offer.productType, status: offer.status },
    expectedLineageUpdate: { id: lineages[0].id, lastSourceHash: built.canonicalHash },
    expectedMigrationRecordAction: "UPDATE",
    expectedDeltas: { offerCount: 0, offerRowsUpdated: 1, migrationLineageCount: 0, migrationLineageRowsUpdated: 1, migrationRecord: 1, mediaAsset: 0, offerMedia: 0, place: 0, business: 0, user: 0, city: 0, category: 0, storage: 0 },
  }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
