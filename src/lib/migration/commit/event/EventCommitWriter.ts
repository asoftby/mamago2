import type { Activity, Prisma, PrismaClient } from "@prisma/client";

import { syncActivityNextOccurrenceAt } from "@/lib/business/eventMutationSideEffects";
import { replaceActivitySessionsFromScheduleJson } from "@/lib/business/syncEventActivitySessions";
import type { EventCreateDraft } from "./types";

/**
 * The narrowest slice of `PrismaClient` this writer needs — just
 * the Activity write methods plus the existing event discovery sync surface.
 * No `eventVenue`, no `activityImage`, no `migrationLineage`/
 * `migrationRecord` delegates — they aren't present on this type, so this
 * writer cannot call them even by mistake.
 */
export interface EventCommitWriterPrismaClient {
  activity: Pick<PrismaClient["activity"], "create" | "update">;
  activitySession: Pick<
    PrismaClient["activitySession"],
    "createMany" | "deleteMany" | "findFirst" | "findMany"
  >;
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
 * ActivitySession/nextOccurrenceAt sync used by Business Wizard. It makes no
 * decisions — category, organizer, place, schedule, everything already went
 * through `buildEventCreateDraft` (PR17) before reaching here. No
 * `EventVenue`, no images, no lineage, no `MigrationRecord`, no rollback, no
 * batching — that's later PRs.
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
        scheduleJson: draft.scheduleJson as unknown as Prisma.InputJsonValue,
        priceText: draft.priceText,
      },
    });

    await this.syncEventDiscoveryFields(activity.id, draft.scheduleJson);

    return { activityId: activity.id, status: "CREATED" };
  }

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
        status: draft.status,
        cityId: draft.cityId,
        placeId: draft.placeId,
        organizerId: draft.organizerId,
        eventCategoryId: draft.eventCategoryId,
        scheduleMode: draft.scheduleMode,
        scheduleJson: draft.scheduleJson as unknown as Prisma.InputJsonValue,
        priceText: draft.priceText,
      },
    });

    await this.syncEventDiscoveryFields(activity.id, draft.scheduleJson);

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
}
