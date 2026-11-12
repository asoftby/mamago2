import { createHash, randomUUID } from "node:crypto";
import { Prisma, PlanItemTimeType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import { calendarDaySchema } from "@/lib/decision/planRequestSchemas";
import { activePlanScopeFor, familyIdForWrite } from "@/server/family/familyAccess";
import { computePlanFingerprint } from "@/server/services/dayScenario.service";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";
import { virtualSessionStarts } from "./poolMapping";

/**
 * Saving a day-scenario draft (BACKLOG-230, PR 3a). One call saves one day or the two days of a weekend in ONE
 * transaction: all or nothing. Creates PlanItems; never moves or edits an entry the scenario did not create
 * (addPlanItem / addPlacePlanItem would: they re-date an existing entry of the same activity or place).
 * Idempotent through the same fields the plan editor's save uses (DayScenario.lastSave*).
 */

const MAX_DAYS = 2;
const MAX_ITEMS_PER_DAY = 4;
const ID = z.string().min(1).max(64);

export const saveItemSchema = z.object({
  kind: z.enum(["event", "place"]),
  activityId: ID,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  pinned: z.boolean().optional().default(false),
  travel: z
    .object({ mode: z.enum(["walk", "car", "transit"]), minutes: z.number().min(0).max(600), distanceM: z.number().min(0).max(500_000) })
    .nullable()
    .optional()
    .default(null),
});

/** A saved point the draft could not hold (the pool no longer has it): it stays in the day exactly as it is. */
export const keepPointSchema = z.object({ kind: z.enum(["event", "place"]), activityId: ID });

export const saveRequestSchema = z.object({
  days: z
    .array(z.object({ date: calendarDaySchema, items: z.array(saveItemSchema).min(1).max(MAX_ITEMS_PER_DAY), keep: z.array(keepPointSchema).max(MAX_ITEMS_PER_DAY).optional().default([]) }))
    .min(1)
    .max(MAX_DAYS),
});
export type SaveRequest = z.infer<typeof saveRequestSchema>;

export class DaySaveError extends Error {
  constructor(public status: number, public code: string, public details?: unknown) {
    super(code);
  }
}

export type SavedItem = { planItemId: string; activityId: string; kind: "event" | "place"; startsAt: string; timeType: "CONFIRMED" | "SUGGESTED"; pinned: boolean };
export type SavedDay = { date: string; scenarioId: string; items: SavedItem[] };
export type SaveResponse = { groupId: string | null; days: SavedDay[] };

/** Stable hash of what the client asked for (order of days/items does not matter). */
export function requestHashOf(request: SaveRequest): string {
  const days = [...request.days]
    .map((day) => ({
      date: day.date,
      items: [...day.items].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.activityId.localeCompare(b.activityId)),
      keep: [...day.keep].map((point) => `${point.kind}:${point.activityId}`).sort(),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return createHash("sha256").update(JSON.stringify(days)).digest("hex");
}

/** Checks that need no database: distinct dates, a distinct point per request, time inside the day, not in the past. */
export function validateSaveRequest(request: SaveRequest, today: string, tz?: string): void {
  const dates = request.days.map((day) => day.date);
  if (new Set(dates).size !== dates.length) throw new DaySaveError(422, "DUPLICATE_DAY");
  const seen = new Set<string>();
  for (const day of request.days) {
    if (day.date < today) throw new DaySaveError(422, "PAST_DAY", day.date);
    for (const item of day.items) {
      const key = `${item.kind}:${item.activityId}`;
      if (seen.has(key)) throw new DaySaveError(422, "DUPLICATE_POINT", item.activityId);
      seen.add(key);
      const start = new Date(item.startsAt);
      const end = new Date(item.endsAt);
      if (!(end.getTime() > start.getTime())) throw new DaySaveError(422, "INVALID_TIME", item.activityId);
      if (getLocalDateKey(start, tz) !== day.date) throw new DaySaveError(422, "INVALID_TIME", item.activityId);
    }
  }
}

type Tx = Prisma.TransactionClient;

type EventRow = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  scheduleJson: unknown;
  sessions: { startsAt: Date; withdrawnAt: Date | null }[];
  /** All ActivitySession rows of the event (the loaded `sessions` are only those near the saved days). */
  _count: { sessions: number };
};
type PlaceRow = { id: string; slug: string | null; title: string; shortAddress: string | null; formattedAddr: string | null; customAddress: string | null; images: { url: string }[] };

/**
 * Time type of a point, judged exactly like the draft pool judged it:
 * - an active (not withdrawn) session starting at exactly this moment: CONFIRMED;
 * - an event with NO ActivitySession row at all whose schedule rules put a start at this moment: SUGGESTED
 *   (any schedule mode: the pool expands rules for all of them);
 * - a place: SUGGESTED (the time is the engine's, inside the opening hours);
 * - anything else (a withdrawn session, a start no session or rule has) cannot be saved.
 */
export function timeTypeFor(kind: "event" | "place", startsAtMs: number, event: Pick<EventRow, "sessions" | "scheduleJson" | "_count"> | null, date: string): PlanItemTimeType {
  if (kind === "place") return PlanItemTimeType.SUGGESTED;
  if (event?.sessions.some((session) => session.withdrawnAt === null && session.startsAt.getTime() === startsAtMs)) return PlanItemTimeType.CONFIRMED;
  if (event && event._count.sessions === 0 && virtualSessionStarts(event.scheduleJson, date, DEFAULT_TZ, 0).includes(startsAtMs)) return PlanItemTimeType.SUGGESTED;
  throw new DaySaveError(422, "INVALID_OCCURRENCE", null);
}

export type SaveDeps = {
  db?: Pick<typeof prisma, "$transaction">;
  scopeFor?: (userId: string) => Promise<Prisma.PlanItemWhereInput>;
  familyIdFor?: (userId: string) => Promise<string>;
  today?: string;
};

export async function saveDayScenarios(userId: string, request: SaveRequest, idempotencyKey: string, deps: SaveDeps = {}): Promise<SaveResponse> {
  validateSaveRequest(request, deps.today ?? getLocalDateKey());
  const requestHash = requestHashOf(request);
  const days = [...request.days].sort((a, b) => a.date.localeCompare(b.date));
  const dates = days.map((day) => day.date);
  const groupId = days.length > 1 ? randomUUID() : null;
  const [scope, familyId] = await Promise.all([(deps.scopeFor ?? activePlanScopeFor)(userId), (deps.familyIdFor ?? familyIdForWrite)(userId)]);

  return (deps.db ?? prisma).$transaction(
    async (tx: Tx) => {
      // Rows for every day exist (and are locked in date order, so two saves cannot deadlock) before anything else is read.
      for (const date of dates) {
        await tx.dayScenario.upsert({ where: { userId_date: { userId, date } }, create: { userId, date, planFingerprint: "", source: "ENGINE" }, update: {} });
      }
      await tx.$queryRaw`SELECT id FROM "DayScenario" WHERE "userId" = ${userId} AND "date" = ANY(${dates}::text[]) ORDER BY "date" FOR UPDATE`;
      const rows = await tx.dayScenario.findMany({ where: { userId, date: { in: dates } }, orderBy: { date: "asc" } });
      const first = rows[0]!;

      if (first.lastSaveIdempotencyKey === idempotencyKey) {
        if (first.lastSaveRequestHash !== requestHash || !first.lastSaveResponse) throw new DaySaveError(409, "IDEMPOTENCY_KEY_REUSED");
        return first.lastSaveResponse as unknown as SaveResponse;
      }

      const eventIds = days.flatMap((d) => d.items.filter((i) => i.kind === "event").map((i) => i.activityId));
      const placeIds = days.flatMap((d) => d.items.filter((i) => i.kind === "place").map((i) => i.activityId));

      const [events, places, taken] = await Promise.all([
        eventIds.length
          ? tx.activity.findMany({
              where: { id: { in: eventIds }, status: "PUBLISHED" },
              select: {
                id: true, title: true, coverImageUrl: true, scheduleJson: true,
                // Only the sessions near the saved days (a long-running event has many); _count answers "has any session at all".
                sessions: { where: { startsAt: { gte: new Date(Date.parse(`${dates[0]}T00:00:00Z`) - 36 * 3_600_000), lt: new Date(Date.parse(`${dates[dates.length - 1]}T00:00:00Z`) + 60 * 3_600_000) } }, select: { startsAt: true, withdrawnAt: true } },
                _count: { select: { sessions: true } },
              },
            })
          : Promise.resolve([] as EventRow[]),
        placeIds.length
          ? tx.place.findMany({ where: { id: { in: placeIds } }, select: { id: true, slug: true, title: true, shortAddress: true, formattedAddr: true, customAddress: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } })
          : Promise.resolve([] as PlaceRow[]),
        // What the user already has of these points. Entries this very scenario created are ours to rewrite; anything else is not touched.
        tx.planItem.findMany({
          // AND, never a spread: the family scope has its own top-level OR (shared entries or the user's own) that a second OR would replace.
          // From today on only (what the draft excludes): a place visited last month does not block it forever.
          where: { AND: [scope, { date: { gte: deps.today ?? getLocalDateKey() } }, { OR: [...(eventIds.length ? [{ activityId: { in: eventIds } }] : []), ...(placeIds.length ? [{ placeId: { in: placeIds } }] : [])] }] },
          select: { id: true, activityId: true, placeId: true, scenarioId: true, date: true },
        }),
      ]);
      const eventById = new Map<string, EventRow>(events.map((e) => [e.id, e]));
      const placeById = new Map<string, PlaceRow>(places.map((p) => [p.id, p]));

      // An entry of this scenario still on its day is ours to rewrite; one the user moved to another day is theirs (a clash).
      const dayOf = new Map(rows.map((r) => [r.id, r.date]));
      const foreign = taken.filter((row) => !row.scenarioId || dayOf.get(row.scenarioId) !== row.date);
      const dupEvents = foreign.flatMap((row) => (row.activityId ? [row.activityId] : []));
      const dupPlaces = foreign.flatMap((row) => (row.placeId ? [row.placeId] : []));
      if (dupEvents.length > 0) throw new DaySaveError(409, "DUPLICATE_ACTIVITY", { ids: [...new Set(dupEvents)] });
      if (dupPlaces.length > 0) throw new DaySaveError(409, "DUPLICATE_PLACE", { ids: [...new Set(dupPlaces)] });
      for (const id of eventIds) if (!eventById.has(id)) throw new DaySaveError(422, "INVALID_POINT", { id });
      for (const id of placeIds) if (!placeById.has(id)) throw new DaySaveError(422, "INVALID_POINT", { id });

      const savedDays: SavedDay[] = [];
      for (const day of days) {
        const row = rows.find((r) => r.date === day.date)!;
        // Re-saving a day: its own earlier entries are replaced; manual and foreign entries stay.
        const mine = await tx.planItem.findMany({ where: { scenarioId: row.id, date: day.date }, select: { id: true, activityId: true, placeId: true } });
        // Points the draft could not hold (keep) are not touched: neither rewritten nor treated as dropped.
        const wanted = new Set([...day.items.map((item) => `${item.kind}:${item.activityId}`), ...day.keep.map((point) => `${point.kind}:${point.activityId}`)]);
        const stale = mine.filter((item) => !wanted.has(item.activityId ? `event:${item.activityId}` : `place:${item.placeId}`));
        if (stale.length > 0) await tx.planItem.deleteMany({ where: { id: { in: stale.map((item) => item.id) }, scenarioId: row.id } });
        const keep = new Map(mine.filter((item) => !stale.includes(item)).map((item) => [item.activityId ? `event:${item.activityId}` : `place:${item.placeId}`, item.id]));

        const saved: SavedItem[] = [];
        const legs: { planItemId: string; mode: string; minutes: number; distanceM: number }[] = [];
        for (const item of day.items) {
          const event = item.kind === "event" ? eventById.get(item.activityId)! : null;
          const place = item.kind === "place" ? placeById.get(item.activityId)! : null;
          const startsAt = new Date(item.startsAt);
          const timeType = timeTypeFor(item.kind, startsAt.getTime(), event, day.date);
          const data = {
            date: day.date,
            startsAt,
            endsAt: new Date(item.endsAt),
            title: event?.title ?? place!.title,
            coverImageUrl: event?.coverImageUrl ?? place?.images[0]?.url ?? null,
            // A place point keeps its address on the entry, so its preview needs no extra query on the day list.
            ...(place ? { locationText: place.shortAddress?.trim() || place.formattedAddr?.trim() || place.customAddress?.trim() || null } : {}),
            timeType,
            pinned: item.pinned,
            scenarioId: row.id,
          };
          const existingId = keep.get(`${item.kind}:${item.activityId}`);
          const planItemId = existingId
            ? (await tx.planItem.update({ where: { id: existingId }, data, select: { id: true } })).id
            : (
                await tx.planItem.create({
                  data: {
                    userId,
                    familyId,
                    ...data,
                    ...(event ? { activityId: event.id } : { placeId: place!.id, planPlaceSlug: place!.slug }),
                  },
                  select: { id: true },
                })
              ).id;
          saved.push({ planItemId, activityId: item.activityId, kind: item.kind, startsAt: startsAt.toISOString(), timeType, pinned: item.pinned });
          if (item.travel) legs.push({ planItemId, mode: item.travel.mode, minutes: item.travel.minutes, distanceM: item.travel.distanceM });
        }
        savedDays.push({ date: day.date, scenarioId: row.id, items: saved.sort((a, b) => a.startsAt.localeCompare(b.startsAt)) });
        row.legsJson = legs as unknown as Prisma.JsonValue;
      }

      const response: SaveResponse = { groupId, days: savedDays };
      for (const day of savedDays) {
        const row = rows.find((r) => r.date === day.date)!;
        // The plan editor's fingerprint must match the day as it is now, or it would report "the plan changed".
        const items = await tx.planItem.findMany({ where: { ...scope, date: day.date }, select: { id: true, activityId: true, routeId: true, placeId: true, articleId: true, date: true, startsAt: true, endsAt: true, childId: true } });
        await tx.dayScenario.update({
          where: { id: row.id },
          data: {
            groupId,
            source: "ENGINE",
            legsJson: (row.legsJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            planFingerprint: computePlanFingerprint(items, new Map(), row.acceptedConflictKeys),
            lastSaveIdempotencyKey: idempotencyKey,
            lastSaveRequestHash: requestHash,
            lastSaveResponse: response as unknown as Prisma.InputJsonValue,
          },
        });
      }
      return response;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}
