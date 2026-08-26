import { HomeStoryPlacementType, HomeStorySourceType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { applyRenderPolicy } from "@/lib/stories/renderPolicy";
import { seededShuffle, storySlotShuffleSeed } from "@/lib/stories/shuffle";
import { zonedDateKey } from "@/lib/stories/ranges";
import type { StoryRailItem } from "@/lib/stories/items";
import { stripHtml } from "@/lib/search/sanitizeSearchText";
import { buildActivityPublicPath } from "@/lib/public/publicVerticalResolver";
import { activityAddressLine, resolveActivityAgeLabel } from "@/lib/search/metaLines";
import { formatAgeTagsCompact } from "@/lib/config/ages";
import { formatPrice } from "@/lib/formatters/format-price";
import { resolveScenarioScheduling } from "@/features/my-plan/lib/scenarioScheduling";
import type { StoryCollection, StoryIntent, StoryItem } from "@/features/stories/types/story";
import { listBreakingNewsArticles } from "@/features/stories/lib/listBreakingNews";
import { buildStoryRailData } from "./resolveStoryRail";
import { getPublicStoryIntentConfigs } from "./storyIntentConfig";
import { isPublicHomeStoryItem } from "./homeStoryPolicy";

const MAX_ITEMS = 5;

function plain(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    const normalized = value ? stripHtml(value).replace(/\s+/g, " ").trim() : "";
    if (normalized) return normalized;
  }
  return undefined;
}

function overrideIdentity(item: StoryRailItem): string {
  return `${item.entityKind === "activity" ? "EVENT" : "OFFER"}:${item.entityId}:${item.sessionId ?? item.entityId}`;
}

function formatPeriod(input: { start: Date; end: Date; timeZone: string }): string {
  const start = input.start.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: input.timeZone });
  const end = input.end.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: input.timeZone });
  return start === end ? start : `${start} — ${end}`;
}

/** Canonical price label: routes both `priceFrom` and free-text `priceText` through the shared BYN formatter. */
function resolvePriceLabel(priceFrom: number | null | undefined, priceText: string | null | undefined): string | undefined {
  if (priceFrom === 0) return "Бесплатно";
  const text = plain(priceText);
  if (text) {
    const formatted = formatPrice(text, { hideZero: true });
    if (formatted) return formatted;
  }
  if (priceFrom != null) {
    const formatted = formatPrice(priceFrom, { hideZero: true });
    if (formatted) return formatted;
  }
  return undefined;
}

function formatTimeHM(date: Date, timeZone: string): string {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone });
}

/**
 * Real-time label for the "running" eyebrow. Reuses {@link resolveScenarioScheduling}
 * (My Plan's canonical start/end resolver — handles exact scheduleItems,
 * durationMinutes and midnight rollover) against the same session `at` the
 * rail already selected as this activity's current occurrence. Never
 * fabricates an end time: with no reliable end, falls back to the plain
 * static label.
 */
function resolveRunningEyebrow(input: {
  now: Date;
  sessionStart: Date;
  activity: { schedulingKind: "SLOT" | "WINDOW" | null; scheduleJson: unknown };
  timeZone: string;
}): string {
  const { now, sessionStart, activity, timeZone } = input;
  if (sessionStart.getTime() <= 0) return "Идёт сейчас";

  const scheduling = resolveScenarioScheduling({
    activity,
    timing: { effectiveStartsAt: sessionStart, isFlexible: false, timeSource: "fixed" },
  });
  const end = scheduling.endsAt;
  const isRunning = now.getTime() >= sessionStart.getTime() && (end == null || now.getTime() < end.getTime());
  if (isRunning) {
    return end ? `Идёт сейчас · до ${formatTimeHM(end, timeZone)}` : "Идёт сейчас";
  }
  if (now.getTime() < sessionStart.getTime()) {
    const sameDay = zonedDateKey(sessionStart, timeZone) === zonedDateKey(now, timeZone);
    const dayLabel = sameDay
      ? "Сегодня"
      : sessionStart.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone });
    const timeLabel = end
      ? `${formatTimeHM(sessionStart, timeZone)}–${formatTimeHM(end, timeZone)}`
      : formatTimeHM(sessionStart, timeZone);
    return `${dayLabel} · ${timeLabel}`;
  }
  // Start has passed but no reliable end time was found — the rail still
  // classifies this as running; keep the honest static fallback instead of
  // guessing when it ends.
  return "Идёт сейчас";
}

/**
 * Public Stories 2.0 read model. Canonical content is loaded once by the rail
 * engine; HomeStoryItem participates only as placement metadata. Snapshot
 * columns are deliberately never read into the public viewer model.
 */
export async function loadPublicStoryCollections(input: {
  cityId: string;
  citySlug: string;
  now?: Date;
  bypassCache?: boolean;
}): Promise<StoryCollection[]> {
  const now = input.now ?? new Date();
  const [rail, configs, breakingNews, city] = await Promise.all([
    buildStoryRailData({ cityId: input.cityId, now, bypassCache: input.bypassCache }),
    getPublicStoryIntentConfigs(),
    listBreakingNewsArticles(input.citySlug).catch(() => []),
    prisma.city.findUnique({ where: { id: input.cityId }, select: { name: true } }),
  ]);
  const cityName = city?.name ?? null;
  const configByIntent = new Map(configs.map((row) => [row.intent, row]));
  console.log("[DEBUG-free] rail.resolved ids:", rail.resolved.map((s) => s.id));
  console.log("[DEBUG-free] free stat items:", rail.stats.find((s) => s.slot.id === "free")?.breakdown.items.length);
  console.log("[DEBUG-free] free config:", configs.find((c) => c.intent === "free"));
  const resolved = applyRenderPolicy(rail.resolved);
  console.log("[DEBUG-free] resolved after policy:", resolved.map((s) => s.id));
  const rangeStarts = rail.stats.map((stat) => stat.slot.range.start);
  const rangeEnds = rail.stats.map((stat) => stat.slot.range.end);
  // Next's persistent cache serializes nested Dates; normalize at the public
  // adapter boundary instead of relying on their runtime prototype.
  const from = new Date(Math.min(...rangeStarts.map((value) => new Date(value).getTime())));
  const until = new Date(Math.max(...rangeEnds.map((value) => new Date(value).getTime())));

  const overrides = await prisma.homeStoryItem.findMany({
    where: {
      cityId: input.cityId,
      storyDate: { gte: from, lt: until },
      OR: [
        { placementType: { not: HomeStoryPlacementType.AUTO } },
        { pinned: true },
        { manualOrder: { not: null } },
        { displayFrom: { not: null } },
        { displayUntil: { not: null } },
      ],
    },
    select: {
      id: true, sourceType: true, sourceId: true, occurrenceKey: true,
      placementType: true, status: true, pinned: true, manualOrder: true,
      displayFrom: true, displayUntil: true, storyDate: true,
    },
  });
  const overrideByIdentity = new Map(overrides.map((row) => [
    `${row.sourceType}:${row.sourceId}:${row.occurrenceKey}`,
    row,
  ]));
  const overrideForItem = (item: StoryRailItem) => overrideByIdentity.get(overrideIdentity(item))
    ?? overrides.find((row) => row.sourceType === (item.entityKind === "activity" ? HomeStorySourceType.EVENT : HomeStorySourceType.OFFER) && row.sourceId === item.entityId);

  const slotItems = new Map<string, StoryRailItem[]>();
  for (const slot of resolved) {
    const stat = rail.stats.find((candidate) => candidate.slot.id === slot.id);
    if (!stat) continue;
    const items = seededShuffle(stat.breakdown.items, storySlotShuffleSeed(slot.id, rail.dateKey))
      .filter((item) => {
        const placement = overrideForItem(item);
        return !placement || (placement.placementType !== HomeStoryPlacementType.EXCLUDE && isPublicHomeStoryItem(placement, now));
      })
      .sort((a, b) => {
        const left = overrideForItem(a);
        const right = overrideForItem(b);
        return Number(right?.pinned ?? false) - Number(left?.pinned ?? false)
          || (left?.manualOrder ?? Number.MAX_SAFE_INTEGER) - (right?.manualOrder ?? Number.MAX_SAFE_INTEGER);
      });
    slotItems.set(slot.id, items);
    if (slot.id === "free") console.log("[DEBUG-free] slotItems free after filter:", items.length, items.map((i) => i.id));
  }

  // FORCE_INCLUDE is a canonical reference. It is added only when its current
  // entity/session survives the same public visibility hydration below.
  const forced = overrides.filter((row) => row.placementType === HomeStoryPlacementType.FORCE_INCLUDE && isPublicHomeStoryItem(row, now));
  const forcedOfferSessionIds = forced.filter((row) => row.sourceType === HomeStorySourceType.OFFER).map((row) => row.occurrenceKey);
  if (forcedOfferSessionIds.length > 0 && slotItems.has("today")) {
    const sessions = await prisma.offerSession.findMany({
      where: { id: { in: forcedOfferSessionIds }, offer: { status: "PUBLISHED", OR: [{ cityId: input.cityId }, { place: { cityId: input.cityId } }] } },
      select: { id: true, offerId: true, startAt: true, offer: { select: { title: true, placeId: true, coverImage: true } } },
    });
    const additions: StoryRailItem[] = sessions.map((row) => ({
      id: `offer-session:${row.id}`, entityKind: "offer", entityId: row.offerId,
      sessionId: row.id, placeId: row.offer.placeId, coverMediaAssetId: null,
      title: row.offer.title, at: row.startAt, timeClass: "point",
    }));
    const existing = new Set(slotItems.get("today")!.map((row) => row.id));
    slotItems.set("today", [...additions.filter((row) => !existing.has(row.id)), ...slotItems.get("today")!]);
  }

  const allItems = [...new Map([...slotItems.values()].flat().map((row) => [row.id, row])).values()];
  const activityIds = [...new Set(allItems.filter((row) => row.entityKind === "activity").map((row) => row.entityId))];
  const offerIds = [...new Set(allItems.filter((row) => row.entityKind === "offer").map((row) => row.entityId))];
  const placeIds = [...new Set(allItems.map((row) => row.placeId).filter((id): id is string => Boolean(id)))];
  const mediaIds = [...new Set(allItems.map((row) => row.coverMediaAssetId).filter((id): id is string => Boolean(id)))];
  const [activities, offers, places, media, activitySessions] = await Promise.all([
    activityIds.length ? prisma.activity.findMany({ where: { id: { in: activityIds }, status: "PUBLISHED" }, select: { id: true, slug: true, type: true, title: true, description: true, shortDesc: true, coverImageUrl: true, priceFrom: true, priceText: true, currency: true, agePolicy: true, ageLabel: true, ageTags: true, ageMinMonths: true, ageMaxMonths: true, schedulingKind: true, scheduleJson: true, venue: { select: { title: true, addressLine: true } } } }) : [],
    offerIds.length ? prisma.offer.findMany({ where: { id: { in: offerIds }, status: "PUBLISHED" }, select: { id: true, slug: true, title: true, description: true, coverImage: true, priceFrom: true, priceText: true, dateFrom: true, dateTo: true, agePolicy: true, ageMinMonths: true, ageMaxMonths: true } }) : [],
    placeIds.length ? prisma.place.findMany({ where: { id: { in: placeIds } }, select: { id: true, title: true, displayAddress: true, formattedAddr: true, customAddress: true } }) : [],
    mediaIds.length ? prisma.mediaAsset.findMany({ where: { id: { in: mediaIds } }, select: { id: true, publicUrl: true } }) : [],
    activityIds.length ? prisma.activitySession.findMany({ where: { activityId: { in: activityIds } }, select: { activityId: true, startsAt: true }, orderBy: { startsAt: "asc" } }) : [],
  ]);
  const activityById = new Map(activities.map((row) => [row.id, row]));
  const offerById = new Map(offers.map((row) => [row.id, row]));
  const placeById = new Map(places.map((row) => [row.id, row]));
  const mediaById = new Map(media.map((row) => [row.id, row.publicUrl]));
  const activityPeriodById = new Map<string, { start: Date; end: Date }>();
  for (const session of activitySessions) {
    const period = activityPeriodById.get(session.activityId);
    if (!period) activityPeriodById.set(session.activityId, { start: session.startsAt, end: session.startsAt });
    else period.end = session.startsAt;
  }

  const hydrate = (row: StoryRailItem, intent: string): StoryItem | null => {
    const place = row.placeId ? placeById.get(row.placeId) : undefined;
    const at = new Date(row.at);
    const datetime = at.getTime() > 0 ? at.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: rail.timeZone }) : undefined;
    if (row.entityKind === "activity") {
      const entity = activityById.get(row.entityId);
      if (!entity) return null;
      const period = activityPeriodById.get(entity.id);
      const activityDatetime = row.timeClass === "serial" && period
        ? formatPeriod({ ...period, timeZone: rail.timeZone })
        : datetime;
      const age = entity.agePolicy === "ADULT_ONLY"
        ? "18+"
        : formatAgeTagsCompact(entity.ageTags) ?? resolveActivityAgeLabel(entity) ?? undefined;
      const price = resolvePriceLabel(entity.priceFrom, entity.priceText);
      const eyebrow = intent === "free"
        ? "бесплатно"
        : intent === "running"
          ? resolveRunningEyebrow({ now, sessionStart: at, activity: entity, timeZone: rail.timeZone })
          : "сегодня";
      const location = activityAddressLine({
        venueTitle: entity.venue?.title,
        venueAddressLine: entity.venue?.addressLine,
        placeTitle: place?.title,
        placeFormattedAddr: place?.formattedAddr,
        placeDisplayAddress: place?.displayAddress,
        placeCustomAddress: place?.customAddress,
        cityName,
      }) ?? undefined;
      return { id: row.id, offerId: row.id, type: "event", title: entity.title, eyebrow, description: plain(entity.shortDesc, entity.description), image: mediaById.get(row.coverMediaAssetId ?? "") ?? entity.coverImageUrl ?? "", location, datetime: activityDatetime, age, price, href: buildActivityPublicPath(input.citySlug, entity.slug ?? entity.id, entity.type) };
    }
    const entity = offerById.get(row.entityId);
    if (!entity) return null;
    const offerDatetime = row.timeClass === "window" && (entity.dateFrom || entity.dateTo)
      ? formatPeriod({ start: entity.dateFrom ?? entity.dateTo!, end: entity.dateTo ?? entity.dateFrom!, timeZone: rail.timeZone })
      : datetime;
    const age = resolveActivityAgeLabel({ agePolicy: entity.agePolicy, ageMinMonths: entity.ageMinMonths, ageMaxMonths: entity.ageMaxMonths }) ?? undefined;
    const price = resolvePriceLabel(entity.priceFrom, entity.priceText);
    const location = activityAddressLine({
      placeTitle: place?.title,
      placeFormattedAddr: place?.formattedAddr,
      placeDisplayAddress: place?.displayAddress,
      placeCustomAddress: place?.customAddress,
      cityName,
    }) ?? undefined;
    return { id: row.id, offerId: row.id, type: "offer", title: entity.title, eyebrow: intent === "free" ? "бесплатно" : "предложение", description: plain(entity.description), image: mediaById.get(row.coverMediaAssetId ?? "") ?? entity.coverImage ?? "", location, datetime: offerDatetime, age, price, href: `/${input.citySlug}/offers/${entity.slug ?? entity.id}` };
  };

  const collections: StoryCollection[] = [];
  for (const slot of resolved) {
    const config = configByIntent.get(slot.id);
    if (config?.enabled === false) continue;
    const items = (slotItems.get(slot.id) ?? []).map((row) => hydrate(row, slot.id)).filter((row): row is StoryItem => row != null).slice(0, MAX_ITEMS);
    if (slot.id === "free") console.log("[DEBUG-free] final hydrated free items:", items.length);
    if (items.length === 0) continue;
    collections.push({ id: slot.id, intent: slot.id as StoryIntent, title: config?.title || slot.label.toLowerCase(), emoji: slot.id === "today" ? "☀️" : slot.id === "free" ? "🎟️" : "▶️", items });
  }
  const breakingConfig = configByIntent.get("breaking_news");
  if (breakingConfig?.enabled !== false && breakingNews.length > 0) {
    collections.push({ id: "breaking-news", intent: "breaking_news", title: breakingConfig?.title || "breaking news", items: breakingNews.slice(0, 6).map((row) => ({ id: `article:${row.id}`, offerId: `article:${row.id}`, type: "breaking-news", eyebrow: "BREAKING NEWS", title: row.title, description: plain(row.description, row.excerpt), image: row.imageUrl ?? "", href: row.href, datetime: row.publishedAt ? new Date(row.publishedAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : undefined })) });
  }
  return collections.sort((a, b) => (configByIntent.get(a.intent)?.order ?? 999) - (configByIntent.get(b.intent)?.order ?? 999));
}
