import type { MigrationLineage, MigrationRecord, Offer, PrismaClient } from "@prisma/client";
import type { NormalizedOfferCandidate } from "../../adapters/wordpress-db/normalizeOffer";
import { normalizeSingleLineText } from "../../text/normalizeSingleLineText";
import type { CreateLineageResult } from "../../lineage/types";
import type { CommitOperation } from "../types";
import type { ExecuteOfferCommitResult } from "./OfferCommitOrchestrator";
import type { OfferCommitContext } from "./types";
import type { OfferMediaSyncer } from "./OfferMediaSyncer";
import { buildOfferCreateDraft } from "./buildOfferCreateDraft";

export interface OfferCommitOrchestratorLike {
  execute(input: {
    candidate: NormalizedOfferCandidate;
    context: OfferCommitContext;
    action: "CREATE" | "UPDATE";
    updateCas?: { id: string; expectedTitle: string; expectedUpdatedAt: Date; placeId: string };
  }): Promise<ExecuteOfferCommitResult>;
}
export interface OfferLineageWriterLike {
  createLineage(input: { sourceId: string; sourceEntityType: string; sourceStableKey: string; sourceRecordKey: string; targetType: "OFFER"; targetId: string; targetStableKey?: string | null; lastSourceHash: string; runId?: string | null; recordId?: string | null }): Promise<CreateLineageResult>;
}
export interface OfferCommitRunnerPrismaClient {
  offer: Pick<PrismaClient["offer"], "findUnique">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findMany" | "update">;
  migrationRecord: Pick<PrismaClient["migrationRecord"], "update">;
}
export interface ExecuteOfferCommitRunInput { operation: CommitOperation; candidate: NormalizedOfferCandidate; context: OfferCommitContext; migrationRecord: MigrationRecord }
export type ExecuteOfferCommitRunResult = { ok: true; offerId: string; lineageId: string; recordId: string; status: "LINKED" } | { ok: false; offerId?: string; recordId: string; status: "FAILED"; errorCode: string; errorMessage: string };

function sameNullable(left: unknown, right: unknown): boolean {
  return left === right || (left == null && right == null);
}

export function hasOnlyOfferTitleWhitespaceDiff(offer: Offer, input: { candidate: NormalizedOfferCandidate; context: OfferCommitContext }): boolean {
  const built = buildOfferCreateDraft(input);
  if (!built.ok) return false;
  const draft = built.draft;
  return offer.title !== draft.title && normalizeSingleLineText(offer.title) === draft.title &&
    offer.placeId === draft.placeId && offer.createRequestId === draft.createRequestId && offer.kind === draft.kind &&
    offer.productType === null && offer.status === draft.status && sameNullable(offer.description, draft.description) &&
    sameNullable(offer.priceFrom, draft.priceFrom) && sameNullable(offer.priceText, draft.priceText) &&
    sameNullable(offer.ageMinMonths, draft.ageMinMonths) && sameNullable(offer.ageMaxMonths, draft.ageMaxMonths) &&
    sameNullable(offer.contactPhone, draft.contactPhone) && sameNullable(offer.contactWebsite, draft.contactWebsite) &&
    sameNullable(offer.seoTitle, draft.seoTitle) && sameNullable(offer.seoDescription, draft.seoDescription) &&
    sameNullable(offer.seoCanonicalUrl, draft.seoCanonicalUrl) && sameNullable(offer.seoRobots, draft.seoRobots) &&
    sameNullable(offer.seoOgTitle, draft.seoOgTitle) && sameNullable(offer.seoOgDescription, draft.seoOgDescription);
}

export class OfferCommitRunner {
  constructor(private readonly deps: { orchestrator: OfferCommitOrchestratorLike; lineageWriter: OfferLineageWriterLike; prisma: OfferCommitRunnerPrismaClient; mediaSyncer?: Pick<OfferMediaSyncer, "sync">; now?: () => Date }) {}

  private async fail(recordId: string, errorCode: string, errorMessage: string, offerId?: string): Promise<ExecuteOfferCommitRunResult> {
    await this.deps.prisma.migrationRecord.update({ where: { id: recordId }, data: { status: "FAILED", lastErrorCode: errorCode, lastErrorMessage: errorMessage } });
    return { ok: false, offerId, recordId, status: "FAILED", errorCode, errorMessage };
  }

  private async resolveUpdate(input: ExecuteOfferCommitRunInput): Promise<{ lineage: MigrationLineage; offer: Offer } | ExecuteOfferCommitRunResult> {
    const rows = await this.deps.prisma.migrationLineage.findMany({ where: { sourceId: input.migrationRecord.sourceId, sourceRecordKey: input.migrationRecord.sourceRecordKey, targetType: "OFFER", isActive: true } });
    const targetId = rows[0]?.targetId;
    if (rows.length !== 1 || !targetId) return this.fail(input.migrationRecord.id, "OFFER_UPDATE_LINEAGE_CONFLICT", `Offer UPDATE requires exactly one active lineage; found ${rows.length}.`);
    const lineage = rows[0];
    const offer = await this.deps.prisma.offer.findUnique({ where: { id: targetId } });
    if (!offer) return this.fail(input.migrationRecord.id, "OFFER_UPDATE_TARGET_MISSING", `Lineage target ${lineage.targetId} does not exist.`);
    if (!lineage.lastImportedAt || offer.updatedAt > lineage.lastImportedAt) return this.fail(input.migrationRecord.id, "OFFER_UPDATE_CONCURRENT_CHANGE", "Offer changed after the last successful import; refusing remediation UPDATE.", offer.id);
    if (lineage.lastSourceHash === input.migrationRecord.sourceHash) return this.fail(input.migrationRecord.id, "OFFER_UPDATE_HASH_UNCHANGED", "UPDATE requires a changed canonical source hash.", offer.id);
    if (!hasOnlyOfferTitleWhitespaceDiff(offer, input)) return this.fail(input.migrationRecord.id, "OFFER_UPDATE_SCOPE_MISMATCH", "Offer remediation diff is not exactly a title whitespace normalization.", offer.id);
    return { lineage, offer };
  }

  async execute(input: ExecuteOfferCommitRunInput): Promise<ExecuteOfferCommitRunResult> {
    const isUpdate = input.operation.action === "UPDATE";
    const updateState = isUpdate ? await this.resolveUpdate(input) : null;
    if (updateState && "ok" in updateState) return updateState;
    const state = updateState as { lineage: MigrationLineage; offer: Offer } | null;
    const committed = await this.deps.orchestrator.execute({
      candidate: input.candidate,
      context: input.context,
      action: input.operation.action,
      ...(state ? { updateCas: { id: state.offer.id, expectedTitle: state.offer.title, expectedUpdatedAt: state.offer.updatedAt, placeId: input.context.placeId } } : {}),
    });
    if (!committed.ok) {
      const errorCode = committed.status === "BLOCKED" ? "OFFER_BLOCKED" : committed.errorCode;
      const errorMessage = committed.status === "BLOCKED" ? committed.blockReasons.map(reason => `${reason.code}: ${reason.message}`).join("; ") : committed.errorMessage;
      return this.fail(input.migrationRecord.id, errorCode, errorMessage, state?.offer.id);
    }
    if (!isUpdate && this.deps.mediaSyncer) {
      try { await this.deps.mediaSyncer.sync({ offerId: committed.offerId, ownerUserId: input.context.ownerUserId, attachmentIds: [...(input.candidate.media.coverAttachmentId === null ? [] : [input.candidate.media.coverAttachmentId]), ...input.candidate.media.galleryAttachmentIds], mediaPolicy: input.context.mediaPolicy, sourceRecordKey: input.migrationRecord.sourceRecordKey }); }
      catch (error) { return this.fail(input.migrationRecord.id, "OFFER_MEDIA_SYNC_FAILED", error instanceof Error ? error.message : String(error), committed.offerId); }
    }
    let lineageId: string;
    try {
      if (state) {
        const lineage = await this.deps.prisma.migrationLineage.update({ where: { id: state.lineage.id }, data: { lastSourceHash: committed.canonicalHash, runId: input.migrationRecord.runId, recordId: input.migrationRecord.id, lastImportedAt: (this.deps.now ?? (() => new Date()))() } });
        lineageId = lineage.id;
      } else {
        const lineage = await this.deps.lineageWriter.createLineage({ sourceId: input.migrationRecord.sourceId, sourceEntityType: input.migrationRecord.sourceEntityType, sourceStableKey: input.migrationRecord.sourceStableKey, sourceRecordKey: input.migrationRecord.sourceRecordKey, targetType: "OFFER", targetId: committed.offerId, targetStableKey: committed.offerId, lastSourceHash: committed.canonicalHash, runId: input.migrationRecord.runId, recordId: input.migrationRecord.id });
        lineageId = lineage.lineageId;
      }
    } catch (error) { return this.fail(input.migrationRecord.id, state ? "LINEAGE_UPDATE_FAILED" : "LINEAGE_WRITE_FAILED", error instanceof Error ? error.message : String(error), committed.offerId); }
    await this.deps.prisma.migrationRecord.update({ where: { id: input.migrationRecord.id }, data: { status: "LINKED", sourceHash: committed.canonicalHash, lastErrorCode: null, lastErrorMessage: null } });
    return { ok: true, offerId: committed.offerId, lineageId, recordId: input.migrationRecord.id, status: "LINKED" };
  }
}
