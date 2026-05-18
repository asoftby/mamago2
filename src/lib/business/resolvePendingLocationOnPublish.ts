/**
 * resolvePendingLocationOnPublish
 *
 * При публикации события читает pendingLocation из scheduleJson и:
 *  - EXISTING_PLACE  → привязывает существующий Place
 *  - NEW_PLACE / PARSED_LOCATION → ищет дубль; если нет — создаёт Place
 *  - OFFSITE / TBA   → placeId = null
 *
 * Place в БД НЕ создаётся при черновике — только здесь.
 * Всё выполняется внутри переданной Prisma-транзакции.
 */

import { Prisma, EventVenueKind, LocationSource, PlaceKind, ContentStatus } from "@prisma/client";
import { extractStreetName, normalizePlaceName } from "@/lib/slug/slugUtils";

export type PendingLocationMode =
  | "EXISTING_PLACE"
  | "NEW_PLACE"
  | "PARSED_LOCATION"
  | "OFFSITE"
  | "TBA";

export interface PendingLocation {
  mode: PendingLocationMode;
  placeId?: string;
  title?: string;
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
  source?: "manual" | "parser";
  raw?: unknown;
}

/** Максимальное расстояние (метры) для считания мест дублями по гео */
const GEO_DUPLICATE_RADIUS_M = 50;

function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Ищет дубль Place по нормализованному названию + адресу + городу + гео.
 * Возвращает id первого найденного совпадения или null.
 */
async function findDuplicatePlace(
  tx: Prisma.TransactionClient,
  opts: {
    title: string;
    address?: string;
    cityId?: string | null;
    lat?: number;
    lng?: number;
  },
): Promise<string | null> {
  const normalizedTitle = normalizePlaceName(opts.title);

  // Ищем по городу (или без города если не задан)
  const candidates = await tx.place.findMany({
    where: {
      cityId: opts.cityId ?? null,
      status: { not: "DELETED" as ContentStatus },
    },
    select: {
      id: true,
      title: true,
      formattedAddr: true,
      lat: true,
      lng: true,
    },
  });

  for (const c of candidates) {
    // Сравниваем нормализованные названия
    if (normalizePlaceName(c.title) !== normalizedTitle) continue;

    // Если есть адрес — сравниваем нормализованно
    if (opts.address && c.formattedAddr) {
      const normA = opts.address.toLowerCase().replace(/\s+/g, " ").trim();
      const normB = c.formattedAddr.toLowerCase().replace(/\s+/g, " ").trim();
      if (normA !== normB) continue;
    }

    // Если есть координаты — проверяем гео-близость
    if (
      opts.lat !== undefined &&
      opts.lng !== undefined &&
      c.lat !== null &&
      c.lng !== null
    ) {
      const dist = haversineMeters(opts.lat, opts.lng, c.lat, c.lng);
      if (dist > GEO_DUPLICATE_RADIUS_M) continue;
    }

    return c.id;
  }

  return null;
}

export interface ResolvePendingLocationResult {
  /** placeId для записи в Activity.placeId (null для OFFSITE/TBA) */
  placeId: string | null;
  /** true если Place был создан в этом вызове */
  placeCreated: boolean;
  /** Обновлённый scheduleJson с очищенным pendingLocation (snapshot сохранён) */
  updatedScheduleJson: Record<string, unknown>;
}

/**
 * Основная функция — вызывается внутри транзакции при публикации.
 *
 * @param tx          Prisma transaction client
 * @param activityId  ID события
 * @param scheduleJson текущий scheduleJson события
 * @param createdByUserId  ID пользователя (для Place.createdByUserId)
 * @param ownerBusinessId  ID бизнеса (для Place.ownerBusinessId)
 */
export async function resolvePendingLocationOnPublish(
  tx: Prisma.TransactionClient,
  activityId: string,
  scheduleJson: Record<string, unknown>,
  createdByUserId: string,
  ownerBusinessId: string | null,
): Promise<ResolvePendingLocationResult> {
  const raw = scheduleJson.pendingLocation;

  // Нет pendingLocation — ничего не делаем
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      placeId: null,
      placeCreated: false,
      updatedScheduleJson: scheduleJson,
    };
  }

  const pl = raw as Record<string, unknown>;
  const mode = pl.mode as PendingLocationMode | undefined;

  if (!mode) {
    return { placeId: null, placeCreated: false, updatedScheduleJson: scheduleJson };
  }

  // Сохраняем snapshot, очищаем pendingLocation
  const updatedScheduleJson: Record<string, unknown> = {
    ...scheduleJson,
    pendingLocation: null,
    resolvedLocationSnapshot: raw, // архив для истории
  };

  // ── CASE 1: EXISTING_PLACE ────────────────────────────────────────────────
  if (mode === "EXISTING_PLACE") {
    const placeId = typeof pl.placeId === "string" ? pl.placeId : null;

    if (placeId) {
      // Синхронизируем EventVenue
      await tx.eventVenue.upsert({
        where: { activityId },
        create: {
          activityId,
          kind: EventVenueKind.PLACE,
          placeId,
          title: typeof pl.title === "string" ? pl.title : null,
          addressLine: typeof pl.address === "string" ? pl.address : null,
        },
        update: {
          kind: EventVenueKind.PLACE,
          placeId,
          title: typeof pl.title === "string" ? pl.title : null,
          addressLine: typeof pl.address === "string" ? pl.address : null,
        },
      });
    }

    return { placeId, placeCreated: false, updatedScheduleJson };
  }

  // ── CASE 2: NEW_PLACE / PARSED_LOCATION ──────────────────────────────────
  if (mode === "NEW_PLACE" || mode === "PARSED_LOCATION") {
    const title = typeof pl.title === "string" ? pl.title.trim() : null;
    const address = typeof pl.address === "string" ? pl.address.trim() : undefined;
    const cityRaw = typeof pl.city === "string" ? pl.city.trim() : undefined;
    const lat = typeof pl.lat === "number" ? pl.lat : undefined;
    const lng = typeof pl.lng === "number" ? pl.lng : undefined;

    if (!title) {
      // Нет названия — не можем создать Place
      return { placeId: null, placeCreated: false, updatedScheduleJson };
    }

    // Резолвим cityId
    let cityId: string | null = null;
    if (cityRaw) {
      const byId = await tx.city.findUnique({ where: { id: cityRaw }, select: { id: true } });
      if (byId) {
        cityId = byId.id;
      } else {
        const bySlug = await tx.city.findUnique({ where: { slug: cityRaw }, select: { id: true } });
        cityId = bySlug?.id ?? null;
      }
    }

    // Поиск дубля
    const duplicateId = await findDuplicatePlace(tx, { title, address, cityId, lat, lng });

    if (duplicateId) {
      // Используем существующий Place
      await tx.eventVenue.upsert({
        where: { activityId },
        create: {
          activityId,
          kind: EventVenueKind.PLACE,
          placeId: duplicateId,
          title,
          addressLine: address ?? null,
          cityId,
        },
        update: {
          kind: EventVenueKind.PLACE,
          placeId: duplicateId,
          title,
          addressLine: address ?? null,
          cityId,
        },
      });

      return { placeId: duplicateId, placeCreated: false, updatedScheduleJson };
    }

    // Создаём новый Place
    const shortAddress = extractStreetName(address ?? "");
    const createRequestId = `event-publish-${activityId}-${Date.now()}`;

    const newPlace = await tx.place.create({
      data: {
        createdByUserId,
        ownerBusinessId,
        createRequestId,
        status: ContentStatus.PUBLISHED,
        slug: null,
        title,
        shortAddress,
        category: "other",
        shortDesc: title,
        description: null,
        ageTags: [],
        visitFormats: [],
        activityTypes: [],
        lat: lat ?? null,
        lng: lng ?? null,
        googlePlaceId: null,
        formattedAddr: address ?? null,
        addressJson: Prisma.JsonNull,
        customAddress: null,
        locationSource: LocationSource.MANUAL,
        cityId,
        districtAutoId: null,
        districtManualId: null,
        metroAutoId: null,
        metroAutoDistanceM: null,
        metroManualId: null,
        metroManualDistanceM: null,
        placeKind: PlaceKind.STANDALONE,
      },
      select: { id: true },
    });

    await tx.eventVenue.upsert({
      where: { activityId },
      create: {
        activityId,
        kind: EventVenueKind.PLACE,
        placeId: newPlace.id,
        title,
        addressLine: address ?? null,
        cityId,
      },
      update: {
        kind: EventVenueKind.PLACE,
        placeId: newPlace.id,
        title,
        addressLine: address ?? null,
        cityId,
      },
    });

    return { placeId: newPlace.id, placeCreated: true, updatedScheduleJson };
  }

  // ── CASE 3: OFFSITE / TBA ─────────────────────────────────────────────────
  const venueKind = mode === "OFFSITE" ? EventVenueKind.MOBILE : EventVenueKind.TBD;

  await tx.eventVenue.upsert({
    where: { activityId },
    create: { activityId, kind: venueKind, placeId: null },
    update: { kind: venueKind, placeId: null },
  });

  return { placeId: null, placeCreated: false, updatedScheduleJson };
}
