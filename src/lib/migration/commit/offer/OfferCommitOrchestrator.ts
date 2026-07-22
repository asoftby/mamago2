import type { NormalizedOfferCandidate } from "../../adapters/wordpress-db/normalizeOffer";
import { buildOfferCreateDraft } from "./buildOfferCreateDraft";
import type { OfferCommitContext, OfferCommitBlockReason, OfferCommitWarning, OfferCreateDraft } from "./types";
import type { OfferCommitWriteResult, OfferTitleCasInput } from "./OfferCommitWriter";
export interface OfferCommitWriterLike { createOfferFromDraft(draft: OfferCreateDraft): Promise<OfferCommitWriteResult>; updateOfferTitleCas(input: OfferTitleCasInput): Promise<OfferCommitWriteResult> }
export type ExecuteOfferCommitResult = { ok: true; status: "CREATED" | "UPDATED"; offerId: string; canonicalHash: string; warnings: readonly OfferCommitWarning[] } | { ok: false; status: "BLOCKED"; blockReasons: readonly OfferCommitBlockReason[] } | { ok: false; status: "FAILED"; errorCode: string; errorMessage: string };
export class OfferCommitOrchestrator {
  constructor(private readonly writer: OfferCommitWriterLike) {}
  async execute(input: { candidate: NormalizedOfferCandidate; context: OfferCommitContext; action: "CREATE" | "UPDATE"; updateCas?: Omit<OfferTitleCasInput, "newTitle"> }): Promise<ExecuteOfferCommitResult> {
    const built = buildOfferCreateDraft(input); if (!built.ok) return { ok: false, status: "BLOCKED", blockReasons: built.reasons };
    if (input.action === "UPDATE" && !input.updateCas) return { ok: false, status: "FAILED", errorCode: "OFFER_UPDATE_TARGET_MISSING", errorMessage: "Offer UPDATE requires validated CAS state." };
    const written = input.action === "UPDATE" ? await this.writer.updateOfferTitleCas({ ...input.updateCas!, newTitle: built.draft.title }) : await this.writer.createOfferFromDraft(built.draft);
    if (!written.ok) return { ok: false, status: "FAILED", errorCode: written.errorCode, errorMessage: written.errorMessage };
    return { ok: true, status: input.action === "UPDATE" ? "UPDATED" : "CREATED", offerId: written.offerId, canonicalHash: built.canonicalHash, warnings: built.warnings };
  }
}
