import type { Place, Prisma, PrismaClient } from "@prisma/client";

import { mapToCreatePayload, mapToUpdatePayload } from "@/lib/openingHours";

import type { PlaceCreateDraft } from "./types";

/**
 * The narrowest slice of `PrismaClient` this writer needs. `openingHours`
 * and `place.findUnique` exist purely to support opening-hours import
 * (see `createPlaceFromDraft`/`updatePlaceFromDraft` below); everything
 * else — `article`, `migrationLineage`, `migrationReviewTask`, media/
 * redirect delegates — isn't present on this type, so this writer cannot
 * call them even by mistake.
 *
 * `$transaction`'s callback receives this same narrow shape (not the full
 * `PrismaClient`) — deliberately, so a fake for tests never needs to
 * satisfy the full generated client, only ever this interface, recursively.
 */
export interface PlaceCommitWriterPrismaClient {
  place: Pick<PrismaClient["place"], "create" | "update" | "findUnique">;
  openingHours: Pick<PrismaClient["openingHours"], "create" | "update">;
  $transaction<T>(fn: (tx: PlaceCommitWriterPrismaClient) => Promise<T>): Promise<T>;
}

export interface PlaceCommitResult {
  placeId: string;
  status: "CREATED" | "UPDATED";
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

function buildCreateData(draft: PlaceCreateDraft): Prisma.PlaceUncheckedCreateInput {
  return {
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
}

function buildUpdateData(draft: PlaceCreateDraft): Prisma.PlaceUncheckedUpdateInput {
  return {
    title: draft.title,
    shortDesc: draft.shortDesc,
    description: draft.description,
    ...(draft.category?.trim() ? { category: draft.category } : {}),
    status: draft.status,
    locationSource: draft.locationSource,
    cityId: draft.cityId,
    lat: draft.lat,
    lng: draft.lng,
    phone: draft.phone,
    website: draft.website,
  };
}

/**
 * The first real entity writer: `PlaceCreateDraft` -> one `Place` row via
 * one `prisma.place.create()` call. It makes no decisions — category review,
 * createdByUserId, and everything else already went through
 * `buildPlaceCreateDraft` (PR8.5) before reaching here. No lineage, no
 * review task, no media, no rollback, no batching — that's later PRs.
 *
 * `openingHours` is the one exception to "no decisions": when
 * `draft.openingHours` is present, `Place` + `OpeningHours` (+ nested
 * `OpeningHoursRule`/`OpeningHoursInterval`) are written inside one
 * `$transaction` — `openingHoursId` can't be set on `Place.create()`
 * without the `OpeningHours` row existing first, and a failed
 * `openingHours.create()` must never leave a `Place` row with a dangling
 * `openingHoursId` (or a `Place` at all). On `updatePlaceFromDraft`, the
 * existing `openingHoursId` is read first (inside the same transaction)
 * and reused via `openingHours.update()` — `mapToUpdatePayload()` deletes
 * and recreates that row's rules, so a repeated UPDATE never accumulates
 * duplicate `OpeningHours`/`OpeningHoursRule` rows. `draft.openingHours`
 * absent means "leave whatever opening hours this Place already has
 * untouched" — never a destructive default.
 */
export class PlaceCommitWriter {
  constructor(private readonly prisma: PlaceCommitWriterPrismaClient) {}

  async createPlaceFromDraft(draft: PlaceCreateDraft): Promise<PlaceCommitResult> {
    assertDraftIsUsable(draft);
    const data = buildCreateData(draft);

    if (!draft.openingHours) {
      const place: Place = await this.prisma.place.create({ data });
      return { placeId: place.id, status: "CREATED" };
    }

    return this.prisma.$transaction(async (tx) => {
      const openingHours = await tx.openingHours.create({ data: mapToCreatePayload(draft.openingHours!) });
      const place: Place = await tx.place.create({ data: { ...data, openingHoursId: openingHours.id } });
      return { placeId: place.id, status: "CREATED" as const };
    });
  }

  async updatePlaceFromDraft(placeId: string, draft: PlaceCreateDraft): Promise<PlaceCommitResult> {
    assertDraftIsUsable(draft);
    if (!placeId.trim()) {
      throw new Error("placeId is required for Place update.");
    }
    const data = buildUpdateData(draft);

    if (!draft.openingHours) {
      const place: Place = await this.prisma.place.update({ where: { id: placeId }, data });
      return { placeId: place.id, status: "UPDATED" };
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.place.findUnique({ where: { id: placeId }, select: { openingHoursId: true } });

      if (existing?.openingHoursId) {
        await tx.openingHours.update({
          where: { id: existing.openingHoursId },
          data: mapToUpdatePayload(draft.openingHours!),
        });
        const place: Place = await tx.place.update({ where: { id: placeId }, data });
        return { placeId: place.id, status: "UPDATED" as const };
      }

      const openingHours = await tx.openingHours.create({ data: mapToCreatePayload(draft.openingHours!) });
      const place: Place = await tx.place.update({
        where: { id: placeId },
        data: { ...data, openingHoursId: openingHours.id },
      });
      return { placeId: place.id, status: "UPDATED" as const };
    });
  }
}
