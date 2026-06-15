import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { EventVenueKind } from "@prisma/client";

const VALID_KINDS = new Set<string>(Object.values(EventVenueKind));

/**
 * Разрешает город из поля мастера: id, slug или точное имя (как в City.name).
 */
export async function resolveCityIdFromWizardInput(
  raw: unknown,
): Promise<string | null> {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const s = raw.trim();
  const byId = await prisma.city.findUnique({
    where: { id: s },
    select: { id: true },
  });
  if (byId) return byId.id;
  const bySlug = await findCityBySlug(s, { select: { id: true } });
  if (bySlug) return bySlug.id;
  const byName = await prisma.city.findFirst({
    where: { name: s, isLegacyNonCity: false },
    select: { id: true },
  });
  return byName?.id ?? null;
}

function parseVenueKind(raw: unknown): EventVenueKind | null {
  if (typeof raw !== "string" || !VALID_KINDS.has(raw)) return null;
  return raw as EventVenueKind;
}

type VenuePayload = {
  kind?: unknown;
  placeId?: unknown;
  title?: unknown;
  addressLine?: unknown;
  cityId?: unknown;
  note?: unknown;
};

/**
 * Сохраняет EventVenue и денормализует cityId / placeId на Activity — нужно для ленты discovery по городу.
 */
export async function syncEventVenueAndActivityCity(
  activityId: string,
  venue: VenuePayload | null | undefined,
  explicitPlaceId?: string | null,
): Promise<void> {
  const topLevelPlace =
    typeof explicitPlaceId === "string" && explicitPlaceId.trim()
      ? explicitPlaceId.trim()
      : null;

  if (!venue || typeof venue !== "object") {
    if (topLevelPlace) {
      const place = await prisma.place.findUnique({
        where: { id: topLevelPlace },
        select: { cityId: true },
      });
      await prisma.activity.update({
        where: { id: activityId },
        data: {
          placeId: topLevelPlace,
          cityId: place?.cityId ?? undefined,
        },
      });
    }
    return;
  }

  const kind = parseVenueKind(venue.kind);
  if (!kind) return;

  const placeId =
    kind === EventVenueKind.PLACE && typeof venue.placeId === "string"
      ? venue.placeId
      : null;

  let resolvedCityId = await resolveCityIdFromWizardInput(venue.cityId);

  if (placeId) {
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: { cityId: true },
    });
    if (place?.cityId) resolvedCityId = place.cityId;
  }

  const title = typeof venue.title === "string" ? venue.title : null;
  const addressLine =
    typeof venue.addressLine === "string" ? venue.addressLine : null;
  const note = typeof venue.note === "string" ? venue.note : null;

  await prisma.eventVenue.upsert({
    where: { activityId },
    create: {
      activityId,
      kind,
      placeId,
      title,
      addressLine,
      cityId: resolvedCityId,
      note,
    },
    update: {
      kind,
      placeId,
      title,
      addressLine,
      cityId: resolvedCityId,
      note,
    },
  });

  const activityPlaceId =
    kind === EventVenueKind.PLACE ? placeId ?? topLevelPlace ?? null : null;

  await prisma.activity.update({
    where: { id: activityId },
    data: {
      placeId: activityPlaceId,
      cityId: resolvedCityId ?? undefined,
    },
  });
}
