import { prisma } from "@/lib/prisma";
import { getLocalDateKey, addDaysLocal, localWallClockToUtc } from "@/lib/date/localDateKey";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { childScopeFor, activePlanScopeFor } from "@/server/family/familyAccess";
import { rankPlanSuggestionsForCity } from "@/server/services/planSuggestions.service";
import { ageRangeAt } from "@/lib/decision/ageRangeAt";
import { ageYearsAt } from "@/lib/child/birth";
import { getSystemInterestLabel } from "@/lib/config/interests";
import type { WeekendData, WeekendStop } from "@/features/weekend/weekendRules";
import { isWeekendDateInWindow } from "@/features/weekend/weekendRules";
import { publicActivityPath } from "@/lib/business/eventPublicLink";

const MAX_CANDIDATES = 18;

export async function getAdminWeekendData(userId: string, citySlug: string, date: string): Promise<WeekendData | null> {
  if (!isWeekendDateInWindow(date, getLocalDateKey())) return null;
  const city = await findCityBySlug(citySlug.toLowerCase(), { isActive: true });
  if (!city) return null;

  const target = new Date(date + "T12:00:00.000Z");
  const [children, existing] = await Promise.all([
    prisma.child.findMany({
      where: await childScopeFor(userId),
      select: {
        birthDate: true, birthPrecision: true, name: true,
        systemInterests: { select: { interestSlug: true } },
      },
    }),
    prisma.planItem.findMany({
      where: { ...(await activePlanScopeFor(userId)), date },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, startsAt: true, endsAt: true, dueAt: true, dueHasTime: true, source: true, activityId: true, placeId: true, activity: { select: { title: true } }, place: { select: { title: true } } },
    }),
  ]);

  const ages = children.map(child => child.birthDate ? ageYearsAt(child, target) : null).filter((n): n is number => n !== null);
  const ageRangeValues = [...new Set(children.flatMap(child =>
    child.birthDate ? [ageRangeAt(child.birthDate, target, child.birthPrecision)] : []
  ).filter((x): x is string => Boolean(x)))];
  const interestSlugs = [...new Set(children.flatMap(child => child.systemInterests.map(i => i.interestSlug)))];
  const batch = await rankPlanSuggestionsForCity({
    citySlug: city.slug, date, take: MAX_CANDIDATES,
    excludeActivityIds: [],
    ageRangeValues,
    profileInterestSlugs: interestSlugs,
  });

  const ids = batch.suggestions.map(s => s.activity.id);
  const start = localWallClockToUtc(date, "00:00");
  const end = localWallClockToUtc(addDaysLocal(date, 1), "00:00");
  const details = await prisma.activity.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, ageMinMonths: true, ageMaxMonths: true, scheduleMode: true,
      place: { select: { lat: true, lng: true } },
      venue: { select: { place: { select: { lat: true, lng: true } } } },
      sessions: { where: { startsAt: { gte: start, lt: end }, withdrawnAt: null }, orderBy: { startsAt: "asc" }, take: 2, select: { id: true, startsAt: true } },
    },
  });
  const detailsById = new Map(details.map(row => [row.id, row]));

  const activityStops: WeekendStop[] = batch.suggestions.flatMap(({ activity, reasonCodes }) => {
    const detail = detailsById.get(activity.id);
    if (!detail) return [];
    // Age bounds are hard safety/fit constraints, not just ranking boosts.
    const outOfRange = ages.some(age =>
      (detail.ageMinMonths != null && age * 12 + 11 < detail.ageMinMonths)
      || (detail.ageMaxMonths != null && age * 12 > detail.ageMaxMonths)
    );
    if (outOfRange) return [];
    const session = detail.sessions[0] ?? null;
    const venue = detail.place ?? detail.venue?.place;
    const address = activity.place?.shortAddress ?? activity.place?.formattedAddr ?? activity.venue?.addressLine ?? null;
    return [{
      key: "activity:" + activity.id,
      kind: "activity" as const,
      id: activity.id,
      title: activity.title,
      description: activity.eventCategory?.nameRu ?? activity.ageLabel ?? "Событие",
      href: publicActivityPath(activity.id, city.slug, activity.slug),
      imageUrl: activity.coverImageUrl,
      address,
      startsAt: session?.startsAt.toISOString() ?? null,
      sessionId: session?.id ?? null,
      rating: null,
      coords: venue?.lat != null && venue?.lng != null ? { lat: venue.lat, lng: venue.lng } : null,
      reason: reasonCodes.includes("INTEREST_MATCH") ? "По интересам семьи" : "Подходит для выходного",
    }];
  });

  // Places can be visited flexibly. Opening hours are NOT inferred.
  // Published, unarchived city venues only; use real review scores where available.
  const places = await prisma.place.findMany({
    where: { cityId: city.id, status: "PUBLISHED", archivedAt: null, agePolicy: { not: "ADULT_ONLY" } },
    select: {
      id: true, slug: true, title: true, shortDesc: true, googleRating: true,
      googleUserRatingsTotal: true, lat: true, lng: true, shortAddress: true, formattedAddr: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      ageTags: true,
    },
    take: 30,
    orderBy: [{ googleRating: "desc" }, { updatedAt: "desc" }],
  });
  const placeStops: WeekendStop[] = places.map(place => ({
    key: "place:" + place.id,
    kind: "place" as const,
    id: place.id,
    title: place.title,
    description: place.shortDesc || "Место для семейного отдыха",
    href: `/${city.slug}/places/${place.slug || place.id}`,
    imageUrl: place.images[0]?.url ?? null,
    address: place.shortAddress ?? place.formattedAddr,
    startsAt: null,
    sessionId: null,
    rating: place.googleRating != null && (place.googleUserRatingsTotal ?? 0) > 0 ? place.googleRating : null,
    coords: place.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null,
    reason: "Свободное посещение · уточните часы работы",
  }));

  // Balance fixed-time events and flexible places. The user may edit all points.
  const candidates = [...activityStops, ...placeStops].slice(0, MAX_CANDIDATES + 12);
  const picked = [
    ...activityStops.slice(0, 2),
    ...placeStops.slice(0, 1),
  ].slice(0, 3);
  for (const point of candidates) {
    if (picked.length >= 3) break;
    if (!picked.some(p => p.key === point.key)) picked.push(point);
  }

  return {
    city: city.name,
    date,
    childrenLabel: ages.length ? ages.map(age => `${age} лет`).join(", ") : "Возраст детей не указан",
    interestLabels: interestSlugs.slice(0, 4).map(getSystemInterestLabel),
    candidates,
    initialKeys: picked.map(x => x.key),
    existing: existing.map(item => ({
      id: item.id,
      title: item.title ?? item.activity?.title ?? item.place?.title ?? "Запись семьи",
      startsAt: item.startsAt?.toISOString() ?? null,
      endsAt: item.endsAt?.toISOString() ?? null,
      noteWithoutTime: item.startsAt == null,
      kind: item.source === "MANUAL" ? "task" : "catalog",
      activityId: item.activityId,
      placeId: item.placeId,
    })),
    candidateCount: batch.candidateCount + places.length,
    algorithmVersion: "weekend-admin-v1+" + batch.algorithmVersion,
  };
}
