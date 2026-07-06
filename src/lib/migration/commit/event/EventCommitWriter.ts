import type { Activity, Prisma, PrismaClient } from "@prisma/client";

import type { EventCreateDraft } from "./types";

/**
 * The narrowest slice of `PrismaClient` this writer needs — just
 * `activity.create`, typed via Prisma's own generated signature. No
 * `activitySession`, no `eventVenue`, no `activityImage`, no
 * `migrationLineage`/`migrationRecord` delegates — they aren't present on
 * this type, so this writer cannot call them even by mistake.
 */
export interface EventCommitWriterPrismaClient {
  activity: Pick<PrismaClient["activity"], "create">;
}

export interface EventCommitResult {
  activityId: string;
  status: "CREATED";
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
 * row via one `prisma.activity.create()` call. It makes no decisions —
 * category, organizer, place, schedule, everything already went through
 * `buildEventCreateDraft` (PR17) before reaching here. No
 * `ActivitySession`, no `EventVenue`, no images, no lineage, no
 * `MigrationRecord`, no rollback, no batching — that's later PRs.
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
        // `NormalizedEventScheduleDraft` is already a plain, JSON-serializable
        // object (`{ mode, dates }`) — this cast only satisfies Prisma's
        // generated `InputJsonValue` index-signature requirement, it doesn't
        // change what's actually written.
        scheduleJson: draft.scheduleJson as unknown as Prisma.InputJsonValue,
        priceText: draft.priceText,
      },
    });

    return { activityId: activity.id, status: "CREATED" };
  }
}
