import type { Offer, Prisma, PrismaClient } from "@prisma/client";
import type { OfferCreateDraft } from "./types";
export interface OfferCommitWriterPrismaClient { offer: Pick<PrismaClient["offer"], "create" | "updateMany"> }
export type OfferCommitWriteResult = { ok: true; offerId: string } | { ok: false; errorCode: string; errorMessage: string };
export interface OfferTitleCasInput { id: string; expectedTitle: string; expectedUpdatedAt: Date; placeId: string; newTitle: string }
export class OfferCommitWriter {
  constructor(private readonly prisma: OfferCommitWriterPrismaClient) {}
  async createOfferFromDraft(draft: OfferCreateDraft): Promise<OfferCommitWriteResult> {
    if (!draft.placeId.trim() || !draft.title.trim() || draft.status !== "DRAFT") throw new Error("OfferCreateDraft failed writer invariants.");
    const data: Prisma.OfferUncheckedCreateInput = { placeId: draft.placeId, createRequestId: draft.createRequestId, kind: draft.kind, productType: draft.productType, title: draft.title, description: draft.description, status: "DRAFT", priceFrom: draft.priceFrom, priceText: draft.priceText, ageMinMonths: draft.ageMinMonths, ageMaxMonths: draft.ageMaxMonths, contactPhone: draft.contactPhone, contactWebsite: draft.contactWebsite, seoTitle: draft.seoTitle, seoDescription: draft.seoDescription, seoCanonicalUrl: draft.seoCanonicalUrl, seoRobots: draft.seoRobots, seoOgTitle: draft.seoOgTitle, seoOgDescription: draft.seoOgDescription };
    try { const offer: Offer = await this.prisma.offer.create({ data }); return { ok: true, offerId: offer.id } }
    catch (error) { return { ok: false, errorCode: "OFFER_CREATE_FAILED", errorMessage: error instanceof Error ? error.message : String(error) } }
  }
  async updateOfferTitleCas(input: OfferTitleCasInput): Promise<OfferCommitWriteResult> {
    const result = await this.prisma.offer.updateMany({
      where: { id: input.id, title: input.expectedTitle, updatedAt: input.expectedUpdatedAt, placeId: input.placeId, kind: "SERVICE", productType: null, status: "DRAFT" },
      data: { title: input.newTitle },
    });
    if (result.count !== 1) return { ok: false, errorCode: "OFFER_UPDATE_CAS_MISMATCH", errorMessage: `Offer title CAS expected exactly one row; updated ${result.count}.` };
    return { ok: true, offerId: input.id };
  }
}
