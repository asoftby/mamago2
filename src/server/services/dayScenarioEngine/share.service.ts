import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { calendarDaySchema } from "@/lib/decision/planRequestSchemas";

/**
 * «Поделиться» a saved «День от mamaGo» (BACKLOG-230, PR 3c-1): a revocable capability link (/d/[token]) to one day or
 * to the weekend it belongs to. The link reads the scenario live and carries no data about its owner. Same shape as the
 * wishlist share (/w/[token]): an unguessable token, never indexed, never leaked through Referer.
 */

export class ShareError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export type ShareScope = "day" | "group";

export const generateShareToken = (): string => randomBytes(24).toString("base64url");
export const isShareToken = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{32}$/.test(value);

export function parseShareRequest(date: string | null, scope: string | null): { date: string; scope: ShareScope } {
  const parsed = calendarDaySchema.safeParse(date ?? "");
  if (!parsed.success) throw new ShareError(400, "INVALID_DATE");
  if (scope !== "day" && scope !== "group") throw new ShareError(400, "INVALID_SCOPE");
  return { date: parsed.data, scope };
}

type Db = Pick<typeof prisma, "dayScenario" | "dayScenarioShare">;

/**
 * The target must be this user's saved scenario. A weekend ("group") share covers every day of the saved group, so its
 * links are found by the group's dates (the group id itself changes when the weekend is saved again).
 */
async function targetOf(userId: string, date: string, scope: ShareScope, db: Db): Promise<{ weekend: boolean; dates: string[] }> {
  const day = await db.dayScenario.findUnique({ where: { userId_date: { userId, date } }, select: { source: true, groupId: true } });
  if (!day || day.source !== "ENGINE") throw new ShareError(404, "NOT_A_SAVED_DAY");
  if (scope === "group" && day.groupId) {
    const days = await db.dayScenario.findMany({ where: { userId, source: "ENGINE", groupId: day.groupId }, select: { date: true } });
    return { weekend: true, dates: days.map((row) => row.date) };
  }
  return { weekend: false, dates: [date] };
}

const openWhere = (userId: string, target: { weekend: boolean; dates: string[] }) => ({
  userId,
  revokedAt: null,
  date: { in: target.dates },
  // A weekend link is a group link (groupId set); a day link is not.
  groupId: target.weekend ? { not: null } : null,
});

/**
 * Closing covers EVERY open link of those dates, day or weekend: a weekend link whose group was broken (the anchor day
 * saved on its own) still resolves to the anchor day, so it must close with it.
 */
const closeWhere = (userId: string, target: { dates: string[] }) => ({ userId, revokedAt: null, date: { in: target.dates } });

/** The link to share: the existing open one for the same target, else a new one. */
export async function createOrGetShare(userId: string, date: string, scope: ShareScope, db: Db = prisma, token: () => string = generateShareToken): Promise<{ token: string }> {
  const target = await targetOf(userId, date, scope, db);
  const existing = await db.dayScenarioShare.findFirst({ where: openWhere(userId, target), select: { token: true }, orderBy: { createdAt: "desc" } });
  if (existing) return { token: existing.token };
  const anchor = target.weekend ? await db.dayScenario.findUnique({ where: { userId_date: { userId, date } }, select: { groupId: true } }) : null;
  const created = await db.dayScenarioShare.create({ data: { userId, date, groupId: anchor?.groupId ?? null, token: token() }, select: { token: true } });
  return { token: created.token };
}

/** Closes every open link of the target (idempotent: none open is fine). Returns how many were closed. */
export async function revokeShares(userId: string, date: string, scope: ShareScope, db: Db = prisma): Promise<{ closed: number }> {
  const target = await targetOf(userId, date, scope, db);
  const result = await db.dayScenarioShare.updateMany({ where: closeWhere(userId, target), data: { revokedAt: new Date() } });
  return { closed: result.count };
}

// ---------------------------------------------------------------- the public read

export type SharedPoint = { kind: "event" | "place"; title: string; coverUrl: string | null; startsAt: string; suggestedTime: boolean; locationText: string | null; href: string | null };
export type SharedDay = { date: string; points: SharedPoint[] };

type ReadDb = Pick<typeof prisma, "dayScenarioShare" | "dayScenario" | "planItem">;

const DEFAULT_CITY = "minsk";
const safeSlug = (value: string | null | undefined) => (value && /^[A-Za-z0-9_-]+$/.test(value) ? value : null);

/** What the public page shows for a token: the days still saved as «от mamaGo» and their points. null = no (or closed) link. */
export async function getSharedDays(token: string, db: ReadDb = prisma): Promise<SharedDay[] | null> {
  if (!isShareToken(token)) return null;
  const share = await db.dayScenarioShare.findUnique({ where: { token }, select: { userId: true, date: true, groupId: true, revokedAt: true } });
  if (!share || share.revokedAt) return null;
  // A weekend link follows the anchor day's current group (saving the weekend again makes a new group id).
  const anchor = await db.dayScenario.findUnique({ where: { userId_date: { userId: share.userId, date: share.date } }, select: { source: true, groupId: true } });
  if (!anchor || anchor.source !== "ENGINE") return null;
  const scenarios = await db.dayScenario.findMany({
    where: { userId: share.userId, source: "ENGINE", ...(share.groupId && anchor.groupId ? { groupId: anchor.groupId } : { date: share.date }) },
    select: { id: true, date: true },
    orderBy: { date: "asc" },
  });
  if (scenarios.length === 0) return null;
  const rows = await db.planItem.findMany({
    where: { userId: share.userId, scenarioId: { in: scenarios.map((s) => s.id) }, cancelledAt: null, startsAt: { not: null } },
    select: {
      scenarioId: true, date: true, startsAt: true, title: true, coverImageUrl: true, timeType: true, locationText: true, planPlaceSlug: true, placeId: true,
      place: { select: { city: { select: { slug: true } } } },
      activity: { select: { id: true, slug: true, title: true, coverImageUrl: true, place: { select: { title: true, shortAddress: true, formattedAddr: true, customAddress: true, city: { select: { slug: true } } } } } },
    },
    orderBy: { startsAt: "asc" },
  });
  const days: SharedDay[] = [];
  for (const scenario of scenarios) {
    const points: SharedPoint[] = rows
      .filter((row) => row.scenarioId === scenario.id && row.date === scenario.date && row.startsAt)
      .map((row) => {
        const activity = row.activity;
        const city = safeSlug(activity?.place?.city?.slug) ?? DEFAULT_CITY;
        const address = activity?.place ? activity.place.shortAddress?.trim() || activity.place.formattedAddr?.trim() || activity.place.customAddress?.trim() || activity.place.title?.trim() || null : row.locationText?.trim() || null;
        const slug = safeSlug(activity?.slug ?? activity?.id ?? null);
        const placeSlug = safeSlug(row.planPlaceSlug);
        return {
          kind: activity ? ("event" as const) : ("place" as const),
          title: activity?.title ?? row.title ?? "Место",
          coverUrl: row.coverImageUrl ?? activity?.coverImageUrl ?? null,
          startsAt: row.startsAt!.toISOString(),
          suggestedTime: row.timeType === "SUGGESTED",
          locationText: address,
          href: activity ? (slug ? `/${city}/events/${slug}` : null) : placeSlug ? `/${safeSlug(row.place?.city?.slug) ?? DEFAULT_CITY}/places/${placeSlug}` : null,
        };
      });
    if (points.length > 0) days.push({ date: scenario.date, points });
  }
  return days.length > 0 ? days : null;
}
