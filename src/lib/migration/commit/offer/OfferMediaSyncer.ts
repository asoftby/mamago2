import type { MediaPolicyName } from "../../runtime/MigrationProfile";

export interface OfferMediaSyncInput {
  offerId: string;
  ownerUserId: string;
  attachmentIds: readonly number[];
  mediaPolicy: MediaPolicyName;
  sourceRecordKey: string;
  sourceId?: string;
  sourceHash?: string | null;
  runId?: string | null;
  recordId?: string | null;
}
export interface OfferMediaSyncResult { status: "SYNCED" | "SKIPPED_POLICY" | "NO_MEDIA"; importedCount: number; warnings: readonly string[] }
export interface FullOfferMediaSyncDelegate { sync(input: Omit<OfferMediaSyncInput, "mediaPolicy">): Promise<{ importedCount: number; warnings?: readonly string[] }> }

/** Policy boundary only. The FULL delegate must use the existing MediaImportWriter/lineage dedup path. */
export class OfferMediaSyncer {
  constructor(private readonly fullDelegate?: FullOfferMediaSyncDelegate) {}
  async sync(input: OfferMediaSyncInput): Promise<OfferMediaSyncResult> {
    const attachmentIds = [...new Set(input.attachmentIds)];
    if (!attachmentIds.length) return { status: "NO_MEDIA", importedCount: 0, warnings: [] };
    if (input.mediaPolicy !== "FULL") return { status: "SKIPPED_POLICY", importedCount: 0, warnings: [`Offer media skipped by ${input.mediaPolicy} policy.`] };
    if (!input.ownerUserId.trim()) throw new Error("Offer media requires an ownerUserId.");
    if (!this.fullDelegate) throw new Error("FULL Offer media policy requires the existing deduplicating media delegate.");
    const result = await this.fullDelegate.sync({
      offerId: input.offerId,
      ownerUserId: input.ownerUserId,
      attachmentIds,
      sourceRecordKey: input.sourceRecordKey,
      sourceId: input.sourceId,
      sourceHash: input.sourceHash,
      runId: input.runId,
      recordId: input.recordId,
    });
    return { status: "SYNCED", importedCount: result.importedCount, warnings: result.warnings ?? [] };
  }
}
