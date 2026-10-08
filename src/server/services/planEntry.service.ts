import { PlanEntryType, PlanItemSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import { childScopeFor, familyIdForWrite } from "@/server/family/familyAccess";
import type { PlanOwner } from "@/server/services/planOwner";
import { CaptureDraftSchema, type CaptureDraft, type CaptureEntry } from "@/server/services/telegram/capture/captureDraft.schema";

export type CreateFromDraftResult =
  | { status: "created"; planItemIds: string[] }
  | { status: "already_handled"; planItemIds: string[] };

export class PlanEntryError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "INVALID_DRAFT"
      | "DUPLICATE_REQUIRES_CONFIRMATION"
      | "CHILD_NOT_SELECTED",
  ) {
    super(code);
  }
}

function asDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function effectiveDate(entry: CaptureEntry): Date | null {
  return asDate(entry.startsAt.value) ?? asDate(entry.dueAt.value);
}

function assertActionableDraft(value: unknown): CaptureDraft {
  const parsed = CaptureDraftSchema.safeParse(value);
  if (!parsed.success || parsed.data.intent !== "CREATE" || parsed.data.entries.length === 0) {
    throw new PlanEntryError("INVALID_DRAFT");
  }
  for (const entry of parsed.data.entries) {
    if (!effectiveDate(entry)) throw new PlanEntryError("INVALID_DRAFT");
    if (entry.child.state !== "missing" && !entry.child.childId) {
      throw new PlanEntryError("CHILD_NOT_SELECTED");
    }
  }
  return parsed.data;
}

async function assertChildren(owner: PlanOwner, draft: CaptureDraft): Promise<void> {
  const childIds = [
    ...new Set(
      draft.entries
        .map((entry) => entry.child.childId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (childIds.length === 0) return;
  const count = await prisma.child.count({
    where: { id: { in: childIds }, ...(await childScopeFor(owner.userId)) },
  });
  if (count !== childIds.length) throw new PlanEntryError("CHILD_NOT_SELECTED");
}

async function canonicalPlaces(draft: CaptureDraft): Promise<Map<string, string>> {
  const ids = [
    ...new Set(
      draft.entries
        .map((entry) => entry.location.placeId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (ids.length === 0) return new Map();
  const rows = await prisma.place.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true },
  });
  return new Map(rows.map((row) => [row.id, row.title]));
}

function planData(
  owner: PlanOwner,
  familyId: string,
  inboxItemId: string,
  entry: CaptureEntry,
  places: Map<string, string>,
): Prisma.PlanItemCreateArgs["data"] {
  const startsAt = asDate(entry.startsAt.value);
  const dueAt = asDate(entry.dueAt.value);
  const dateSource = startsAt ?? dueAt;
  if (!dateSource) throw new PlanEntryError("INVALID_DRAFT");

  const venuePlaceId = entry.location.placeId;
  const locationText = venuePlaceId
    ? (places.get(venuePlaceId) ?? entry.location.value)
    : entry.location.value;

  return {
    userId: owner.userId,
    familyId,
    source: PlanItemSource.TELEGRAM_FORWARD,
    entryType: entry.entryType as PlanEntryType,
    title: entry.title.value.trim() || null,
    childId: entry.child.childId,
    date: getLocalDateKey(dateSource, "Europe/Minsk"),
    startsAt,
    arriveAt: asDate(entry.arriveAt.value),
    endsAt: asDate(entry.endsAt.value),
    dueAt,
    dueHasTime: entry.dueAt.hasTime && dueAt !== null,
    locationText: locationText?.trim() || null,
    notes: entry.notes?.trim() || null,
    inboxItemId,
    venuePlaceId,
    requirements: {
      create: entry.requirements.map((requirement) => ({
        kind: requirement.kind,
        text: requirement.text.trim(),
        dueAt: asDate(requirement.dueAt),
        dueHasTime: requirement.dueHasTime && requirement.dueAt !== null,
        amount: requirement.amount == null ? null : new Prisma.Decimal(requirement.amount),
        currency: requirement.currency?.trim() || "BYN",
      })),
    },
  };
}

export async function createFromDraft(
  owner: PlanOwner,
  inboxItemId: string,
  options: { allowDuplicate?: boolean } = {},
): Promise<CreateFromDraftResult> {
  const item = await prisma.inboxItem.findFirst({
    where: { id: inboxItemId, userId: owner.userId },
    select: { status: true, draft: true, ruleCodes: true },
  });
  if (!item) throw new PlanEntryError("NOT_FOUND");
  if (item.status !== "DRAFT_READY") {
    return { status: "already_handled", planItemIds: [] };
  }
  if (item.ruleCodes.includes("DUPLICATE_FOUND") && !options.allowDuplicate) {
    throw new PlanEntryError("DUPLICATE_REQUIRES_CONFIRMATION");
  }

  const draft = assertActionableDraft(item.draft);
  await assertChildren(owner, draft);
  const places = await canonicalPlaces(draft);
  const familyId = await familyIdForWrite(owner.userId);

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.inboxItem.updateMany({
      where: { id: inboxItemId, userId: owner.userId, status: "DRAFT_READY" },
      data: { status: "CONFIRMED", draft: Prisma.DbNull, awaitingEditUntil: null },
    });
    if (claimed.count !== 1) {
      return { status: "already_handled", planItemIds: [] } as const;
    }

    const planItemIds: string[] = [];
    for (const entry of draft.entries) {
      const created = await tx.planItem.create({
        data: planData(owner, familyId, inboxItemId, entry, places),
        select: { id: true },
      });
      planItemIds.push(created.id);
    }
    await tx.inboxItemPart.updateMany({
      where: { inboxItemId },
      data: { text: null },
    });
    return { status: "created", planItemIds } as const;
  });
}

export async function discardInboxDraft(
  owner: PlanOwner,
  inboxItemId: string,
): Promise<"discarded" | "already_handled"> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.inboxItem.updateMany({
      where: { id: inboxItemId, userId: owner.userId, status: "DRAFT_READY" },
      data: { status: "DISCARDED", draft: Prisma.DbNull, awaitingEditUntil: null },
    });
    if (claimed.count !== 1) return "already_handled";
    await tx.inboxItemPart.updateMany({
      where: { inboxItemId },
      data: { text: null },
    });
    return "discarded";
  });
}
