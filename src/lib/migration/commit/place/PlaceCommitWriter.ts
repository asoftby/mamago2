import type { Place, Prisma, PrismaClient } from "@prisma/client";

import type { PlaceCreateDraft } from "./types";

/**
 * The narrowest slice of `PrismaClient` this writer needs — just
 * `place.create`, typed via Prisma's own generated signature (so the
 * `data` shape is never hand-duplicated). No `article`, no
 * `migrationLineage`, no `migrationReviewTask`, no media/redirect
 * delegates — they aren't present on this type, so this writer cannot
 * call them even by mistake.
 */
export interface PlaceCommitWriterPrismaClient {
  place: Pick<PrismaClient["place"], "create">;
}

export interface PlaceCommitResult {
  placeId: string;
  status: "CREATED";
}

function assertDraftIsUsable(draft: PlaceCreateDraft): void {
  // Defense-in-depth only — `buildPlaceCreateDraft` (PR8.5) is the real
  // gatekeeper. This writer never repeats that decision logic, it just
  // refuses to silently create a broken row if handed something invalid.
  if (!draft.createdByUserId?.trim()) {
    throw new Error("PlaceCreateDraft.createdByUserId is required.");
  }
  if (!draft.title?.trim()) {
    throw new Error("PlaceCreateDraft.title is required.");
  }
  if (!draft.shortDesc?.trim()) {
    throw new Error("PlaceCreateDraft.shortDesc is required.");
  }
}

/**
 * The first real entity writer: `PlaceCreateDraft` -> one `Place` row via
 * one `prisma.place.create()` call. It makes no decisions — category review,
 * createdByUserId, and everything else already went through
 * `buildPlaceCreateDraft` (PR8.5) before reaching here. No lineage, no
 * review task, no media, no rollback, no batching — that's later PRs.
 */
export class PlaceCommitWriter {
  constructor(private readonly prisma: PlaceCommitWriterPrismaClient) {}

  async createPlaceFromDraft(draft: PlaceCreateDraft): Promise<PlaceCommitResult> {
    assertDraftIsUsable(draft);

    const data = {
      title: draft.title,
      shortDesc: draft.shortDesc,
      description: draft.description,
      ...(draft.category?.trim() ? { category: draft.category } : {}),
      status: draft.status,
      locationSource: draft.locationSource,
      createdByUserId: draft.createdByUserId,
      cityId: draft.cityId,
      lat: draft.lat,
      lng: draft.lng,
      phone: draft.phone,
      website: draft.website,
      slug: draft.slug,
    } as Prisma.PlaceUncheckedCreateInput;

    const place: Place = await this.prisma.place.create({
      data,
    });

    return { placeId: place.id, status: "CREATED" };
  }
}
