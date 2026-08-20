import type { Activity, Prisma, PrismaClient } from "@prisma/client";

import { syncActivityNextOccurrenceAt } from "@/lib/business/eventMutationSideEffects";
import { replaceActivitySessionsFromScheduleJson } from "@/lib/business/syncEventActivitySessions";
import type { EventCreateDraft } from "./types";

/**
 * The narrowest slice of `PrismaClient` this writer needs — the Activity
 * write methods, the existing event discovery sync surface, and one
 * `eventVenue.upsert` for the fallback/matched venue row. No `activityImage`,
 * no `migrationLineage`/`migrationRecord` delegates — they aren't present on
 * this type, so this writer cannot call them even by mistake.
 */
export interface EventCommitWriterPrismaClient {
  activity: Pick<PrismaClient["activity"], "create" | "update">;
  activitySession: Pick<
    PrismaClient["activitySession"],
    "createMany" | "deleteMany" | "findFirst" | "findMany"
  >;
  eventVenue: Pick<PrismaClient["eventVenue"], "upsert">;
}

export interface EventCommitResult {
  activityId: string;
  status: "CREATED" | "UPDATED";
}

function assertDraftIsUsable(draft: EventCreateDraft): void {
  // Defense-in-depth only — `buildEventCreateDraft` (PR17) is the real
  // gatekeeper. This writer never repeats that decision logic, it just
  // refuses to silently create a broken row if handed something invalid.
  if (!draft.title?.trim()) {
    throw new Error("EventCreateDraft.title is required.");
  }
  if (!draft.shortDesc?.trim()) {
    throw new Error("EventCreateDraft.shortDesc is required.");
  }
  if (!draft.ownerUserId?.trim()) {
    throw new Error("EventCreateDraft.ownerUserId is required.");
  }
  if (!draft.scheduleMode) {
    throw new Error("EventCreateDraft.scheduleMode is required.");
  }
  if (draft.type !== "EVENT") {
    throw new Error(`EventCreateDraft.type must be "EVENT", got "${draft.type}".`);
  }
}

/**
 * The first real Event entity writer: `EventCreateDraft` -> one `Activity`
 * row via one `prisma.activity.create()` call, followed by the same
 * ActivitySession/nextOccurrenceAt sync used by Business Wizard, plus an
 * `EventVenue` upsert when `draft.venue` carries fallback/matched venue
 * evidence. It makes no decisions — category, organizer, place, schedule,
 * venue, everything already went through `buildEventCreateDraft` before
 * reaching here. No images, no lineage, no `MigrationRecord`, no rollback,
 * no batching — that's later PRs.
 */
export class EventCommitWriter {
  constructor(private readonly prisma: EventCommitWriterPrismaClient) {}

  async createEventFromDraft(draft: EventCreateDraft): Promise<EventCommitResult> {
    assertDraftIsUsable(draft);

    const activity: Activity = await this.prisma.activity.create({
      data: {
        title: draft.title,
        shortDesc: draft.shortDesc,
        description: draft.description,
        type: draft.type,
        status: draft.status,
        ownerUserId: draft.ownerUserId,
        cityId: draft.cityId,
        placeId: draft.placeId,
        organizerId: draft.organizerId,
        eventCategoryId: draft.eventCategoryId,
        scheduleMode: draft.scheduleMode,
        schedulingKind: draft.schedulingKind,
        scheduleJson: draft.scheduleJson as unknown as Prisma.InputJsonValue,
        priceText: draft.priceText,
      },
    });

    await this.syncEventDiscoveryFields(activity.id, draft.scheduleJson);
    await this.syncEventVenue(activity.id, draft.venue);

    return { activityId: activity.id, status: "CREATED" };
  }

  /**
   * `status` and `cityId` are deliberately never unconditionally overwritten
   * here — see the two dedicated helpers below for why. A migration UPDATE
   * re-normalizes source content, not moderation/editorial decisions already
   * layered on top of a previously-linked Activity.
   */
  async updateEventFromDraft(activityId: string, draft: EventCreateDraft): Promise<EventCommitResult> {
    assertDraftIsUsable(draft);
    if (!activityId.trim()) {
      throw new Error("activityId is required for Event update.");
    }

    const activity: Activity = await this.prisma.activity.update({
      where: { id: activityId },
      data: {
        title: draft.title,
        shortDesc: draft.shortDesc,
        description: draft.description,
        ...cityIdUpdateField(draft.cityId),
        placeId: draft.placeId,
        organizerId: draft.organizerId,
        eventCategoryId: draft.eventCategoryId,
        scheduleMode: draft.scheduleMode,
        scheduleJson: draft.scheduleJson as unknown as Prisma.InputJsonValue,
        priceText: draft.priceText,
      },
    });

    await this.syncEventDiscoveryFields(activity.id, draft.scheduleJson);
    await this.syncEventVenue(activity.id, draft.venue);

    return { activityId: activity.id, status: "UPDATED" };
  }

  private async syncEventDiscoveryFields(
    activityId: string,
    scheduleJson: EventCreateDraft["scheduleJson"],
  ): Promise<void> {
    await replaceActivitySessionsFromScheduleJson({
      prisma: this.prisma,
      activityId,
      scheduleJson,
    });
    await syncActivityNextOccurrenceAt({
      prisma: this.prisma,
      activityId,
    });
  }

  /**
   * `null` (no venue evidence at all) is a no-op — never clears an existing
   * `EventVenue` row on UPDATE just because this run's candidate happened to
   * carry no evidence. Otherwise `upsert` on the unique `activityId` keeps
   * repeated runs idempotent: one row per Activity, never duplicated.
   *
   * `cityId` on the `update` branch follows the same never-clear-on-absent-
   * evidence rule as `Activity.cityId` (see `cityIdUpdateField`) — a brand
   * new venue (`create`) has nothing to preserve, so it always takes
   * whatever the draft carries, including `null`.
   */
  private async syncEventVenue(activityId: string, venue: EventCreateDraft["venue"]): Promise<void> {
    if (!venue) return;
    const shared = {
      kind: venue.kind,
      placeId: venue.placeId,
      title: venue.title,
      addressLine: venue.addressLine,
      lat: venue.lat,
      lng: venue.lng,
      note: venue.note,
      source: venue.source,
    };
    await this.prisma.eventVenue.upsert({
      where: { activityId },
      create: { activityId, ...shared, cityId: venue.cityId },
      update: { ...shared, ...cityIdUpdateField(venue.cityId) },
    });
  }
}

/**
 * `Activity.cityId`/`EventVenue.cityId` UPDATE regression fix: the migration
 * normalizer (`buildEventCreateDraft`) is a pure function with no knowledge
 * of any existing row — `context.cityId` absent/unmatched always produces
 * `draft.cityId: null`, indistinguishable from "the operator proved there is
 * no city." Unconditionally writing that `null` on UPDATE silently erases a
 * city an earlier run (or a human) already established, purely because
 * *this* run's source evidence (or its context config) didn't happen to
 * repeat it — exactly what nulled `wordpress-db:events:60404`'s city in the
 * 2026-07-28 session.
 *
 * A proven non-null `cityId` is real evidence and always applies. A `null`
 * is absence of evidence, not proof of absence — it must never overwrite
 * whatever is already on the row. Deliberate removal of a city is a
 * separate, explicit operation this method does not perform.
 */
function cityIdUpdateField(cityId: string | null): { cityId: string } | Record<string, never> {
  return cityId !== null ? { cityId } : {};
}
