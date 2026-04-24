import { Prisma, ContentStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import type {
  ImportLinkRecoveryPayload,
  ReviewDecisionPayload,
} from "../types";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type ImportedRecordLinkSnapshot = {
  id: string;
  publishedPlaceId: string | null;
  publishedActivityId: string | null;
  reviewDecision?: unknown;
  applyResult?: unknown;
};

type LinkedPlaceState = {
  id: string;
  status: ContentStatus;
  archivedAt: Date | null;
} | null;

type LinkedActivityState = {
  id: string;
  status: ContentStatus;
} | null;

export type ImportLinkState =
  | { kind: "PLACE"; entityId: string }
  | { kind: "ACTIVITY"; entityId: string }
  | { kind: "RECOVERED"; recovery: ImportLinkRecoveryPayload }
  | { kind: "UNLINKED" };

export function isPlaceLinkActive(place: LinkedPlaceState): boolean {
  return Boolean(
    place &&
      place.archivedAt == null &&
      place.status !== ContentStatus.DELETED &&
      place.status !== ContentStatus.ARCHIVED,
  );
}

export function isActivityLinkActive(activity: LinkedActivityState): boolean {
  return Boolean(
    activity &&
      activity.status !== ContentStatus.DELETED &&
      activity.status !== ContentStatus.ARCHIVED,
  );
}

function normalizeReviewDecision(input: unknown): ReviewDecisionPayload | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (typeof raw.decision !== "string") return null;
  return raw as unknown as ReviewDecisionPayload;
}

export function getImportedRecordLinkState(record: ImportedRecordLinkSnapshot): ImportLinkState {
  if (record.publishedPlaceId) {
    return { kind: "PLACE", entityId: record.publishedPlaceId };
  }
  if (record.publishedActivityId) {
    return { kind: "ACTIVITY", entityId: record.publishedActivityId };
  }

  const reviewDecision = normalizeReviewDecision(record.reviewDecision);
  if (reviewDecision?.recovery) {
    return { kind: "RECOVERED", recovery: reviewDecision.recovery };
  }

  return { kind: "UNLINKED" };
}

function buildRecoveryPayload(params: {
  entityType: "PLACE" | "ACTIVITY";
  entityId: string;
  reason: string;
  detachedAt?: string;
}): ImportLinkRecoveryPayload {
  return {
    detachedAt: params.detachedAt ?? new Date().toISOString(),
    invalidLinkedEntityId: params.entityId,
    invalidLinkedEntityType: params.entityType,
    reason: params.reason,
  };
}

function withRecoveryDecision(
  current: unknown,
  recovery: ImportLinkRecoveryPayload,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  const reviewDecision = normalizeReviewDecision(current);
  if (!reviewDecision) return undefined;
  return {
    ...reviewDecision,
    recovery,
  } as unknown as Prisma.InputJsonValue;
}

export function planImportedRecordLinkReconciliation(params: {
  record: ImportedRecordLinkSnapshot;
  place: LinkedPlaceState;
  activity: LinkedActivityState;
  detachedAt?: string;
}) {
  const { record, place, activity, detachedAt } = params;
  const updates: {
    publishedPlaceId?: null;
    publishedActivityId?: null;
    applyResult?: Prisma.NullableJsonNullValueInput;
    reviewDecision?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  } = {};

  let recovery: ImportLinkRecoveryPayload | null = null;

  if (record.publishedPlaceId && !isPlaceLinkActive(place)) {
    recovery = buildRecoveryPayload({
      entityType: "PLACE",
      entityId: record.publishedPlaceId,
      detachedAt,
      reason: place
        ? `Связанный Place недоступен для каталога (status=${place.status}${place.archivedAt ? ", archived" : ""}).`
        : "Связанный Place был удалён из каталога.",
    });
    updates.publishedPlaceId = null;
  }

  if (record.publishedActivityId && !isActivityLinkActive(activity)) {
    recovery = buildRecoveryPayload({
      entityType: "ACTIVITY",
      entityId: record.publishedActivityId,
      detachedAt,
      reason: activity
        ? `Связанное событие недоступно для каталога (status=${activity.status}).`
        : "Связанное событие было удалено из каталога.",
    });
    updates.publishedActivityId = null;
  }

  if (!recovery) {
    return {
      changed: false,
      updates,
      recovery: null,
    };
  }

  updates.applyResult = Prisma.JsonNull;
  const nextReviewDecision = withRecoveryDecision(record.reviewDecision, recovery);
  if (nextReviewDecision !== undefined) {
    updates.reviewDecision = nextReviewDecision;
  }

  return {
    changed: true,
    updates,
    recovery,
  };
}

export async function reconcileImportedRecordLinks<T extends ImportedRecordLinkSnapshot>(
  records: T[],
  db: DbClient = prisma,
): Promise<
  Array<
    T & {
      publishedPlaceId: string | null;
      publishedActivityId: string | null;
      reviewDecision?: unknown;
      applyResult?: unknown;
      linkState: ImportLinkState;
    }
  >
> {
  if (records.length === 0) return [];

  const placeIds = Array.from(
    new Set(records.map((record) => record.publishedPlaceId).filter((id): id is string => Boolean(id))),
  );
  const activityIds = Array.from(
    new Set(records.map((record) => record.publishedActivityId).filter((id): id is string => Boolean(id))),
  );

  const [places, activities] = await Promise.all([
    placeIds.length === 0
      ? Promise.resolve([])
      : db.place.findMany({
          where: { id: { in: placeIds } },
          select: { id: true, status: true, archivedAt: true },
        }),
    activityIds.length === 0
      ? Promise.resolve([])
      : db.activity.findMany({
          where: { id: { in: activityIds } },
          select: { id: true, status: true },
        }),
  ]);

  const placeMap = new Map(places.map((place) => [place.id, place]));
  const activityMap = new Map(activities.map((activity) => [activity.id, activity]));

  const normalized = [...records] as T[];
  const staleUpdates = normalized
    .map((record, index) => {
      const plan = planImportedRecordLinkReconciliation({
        record,
        place: record.publishedPlaceId ? placeMap.get(record.publishedPlaceId) ?? null : null,
        activity: record.publishedActivityId ? activityMap.get(record.publishedActivityId) ?? null : null,
      });
      return { index, record, plan };
    })
    .filter((entry) => entry.plan.changed);

  if (staleUpdates.length > 0) {
    await Promise.all(
      staleUpdates.map((entry) =>
        db.importedRecord.update({
          where: { id: entry.record.id },
          data: entry.plan.updates,
        }),
      ),
    );

    for (const entry of staleUpdates) {
      const current = normalized[entry.index]!;
      normalized[entry.index] = {
        ...current,
        publishedPlaceId:
          entry.plan.updates.publishedPlaceId === null ? null : current.publishedPlaceId,
        publishedActivityId:
          entry.plan.updates.publishedActivityId === null ? null : current.publishedActivityId,
        applyResult:
          entry.plan.updates.applyResult === Prisma.JsonNull ? null : current.applyResult,
        reviewDecision: entry.plan.updates.reviewDecision ?? current.reviewDecision,
      };
    }
  }

  return normalized.map((record) => ({
    ...record,
    linkState: getImportedRecordLinkState(record),
  }));
}

export async function reconcileImportedRecordLinkById(
  importedRecordId: string,
  db: DbClient = prisma,
) {
  const record = await db.importedRecord.findUnique({
    where: { id: importedRecordId },
    select: {
      id: true,
      reviewStatus: true,
      normalizedData: true,
      entityTypeHint: true,
      publishedPlaceId: true,
      publishedActivityId: true,
      reviewDecision: true,
      applyResult: true,
    },
  });

  if (!record) return null;
  const [resolved] = await reconcileImportedRecordLinks([record], db);
  return resolved ?? null;
}

export async function detachImportedRecordsForCatalogEntity(
  params:
    | { entityType: "PLACE"; entityId: string; reason: string }
    | { entityType: "ACTIVITY"; entityId: string; reason: string },
  db: DbClient = prisma,
): Promise<number> {
  const records = await db.importedRecord.findMany({
    where:
      params.entityType === "PLACE"
        ? { publishedPlaceId: params.entityId }
        : { publishedActivityId: params.entityId },
    select: {
      id: true,
      publishedPlaceId: true,
      publishedActivityId: true,
      reviewDecision: true,
      applyResult: true,
    },
  });

  if (records.length === 0) return 0;

  const detachedAt = new Date().toISOString();

  await Promise.all(
    records.map((record) => {
      const recovery = buildRecoveryPayload({
        entityType: params.entityType,
        entityId: params.entityId,
        reason: params.reason,
        detachedAt,
      });

      return db.importedRecord.update({
        where: { id: record.id },
        data: {
          publishedPlaceId: params.entityType === "PLACE" ? null : undefined,
          publishedActivityId: params.entityType === "ACTIVITY" ? null : undefined,
          applyResult: Prisma.JsonNull,
          ...(withRecoveryDecision(record.reviewDecision, recovery) !== undefined
            ? { reviewDecision: withRecoveryDecision(record.reviewDecision, recovery) }
            : {}),
        },
      });
    }),
  );

  return records.length;
}

export async function ensureActiveImportDecisionTarget(params: {
  entityType: "PLACE" | "ACTIVITY";
  entityId: string;
  db?: DbClient;
}): Promise<void> {
  const db = params.db ?? prisma;

  if (params.entityType === "PLACE") {
    const place = await db.place.findUnique({
      where: { id: params.entityId },
      select: { id: true, status: true, archivedAt: true },
    });
    if (!isPlaceLinkActive(place)) {
      throw new Error("Target Place does not exist or is not active in catalog");
    }
    return;
  }

  const activity = await db.activity.findUnique({
    where: { id: params.entityId },
    select: { id: true, status: true },
  });
  if (!isActivityLinkActive(activity)) {
    throw new Error("Target Activity does not exist or is not active in catalog");
  }
}

export function clearRecoveryFromReviewDecision(
  input: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  const reviewDecision = normalizeReviewDecision(input);
  if (!reviewDecision) return undefined;
  if (!reviewDecision.recovery) return undefined;
  return {
    ...reviewDecision,
    recovery: null,
  } as unknown as Prisma.InputJsonValue;
}
