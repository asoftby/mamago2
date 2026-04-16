import prisma from "@/lib/prisma";

/** Часы работы: та же форма, что раньше у include, но без лишних полей у интервалов при возможности — сравнение в diff идёт по JSON. */
const openingHoursForDiff = {
  select: {
    id: true,
    mode: true,
    timezone: true,
    note: true,
    rules: {
      include: {
        intervals: { orderBy: { sortOrder: "asc" as const } },
      },
    },
    exceptions: {
      include: {
        intervals: { orderBy: { sortOrder: "asc" as const } },
      },
    },
  },
} as const;

const placeImagesForGallery = {
  orderBy: { sortOrder: "asc" as const },
  select: {
    id: true,
    url: true,
    kind: true,
    sortOrder: true,
    width: true,
    height: true,
    blurhash: true,
  },
};

const placeImagesLight = {
  orderBy: { sortOrder: "asc" as const },
  select: {
    id: true,
    url: true,
    kind: true,
    sortOrder: true,
  },
};

const placeGeoAndAuthor = {
  city: {
    select: { id: true, name: true, hasMetro: true, metroMaxDistanceM: true },
  },
  districtAuto: { select: { name: true } },
  districtManual: { select: { name: true } },
  metroAuto: { select: { name: true } },
  metroManual: { select: { name: true } },
  createdBy: {
    select: {
      id: true,
      email: true,
      business: { select: { name: true } },
    },
  },
} as const;

/** Скаляры + связи без openingHours — очередь PENDING / DRAFT и т.д. (PlaceModerationView не использует часы). */
export async function loadPlaceForBasicModeration(placeId: string) {
  return prisma.place.findUnique({
    where: { id: placeId },
    select: {
      id: true,
      title: true,
      cityId: true,
      lat: true,
      lng: true,
      phone: true,
      website: true,
      createdAt: true,
      updatedAt: true,
      activityTypes: true,
      addressJson: true,
      ageTags: true,
      category: true,
      countryCode: true,
      customAddress: true,
      description: true,
      formattedAddr: true,
      googlePlaceId: true,
      instagramHandle: true,
      instagramUrl: true,
      locationSource: true,
      logoImageId: true,
      shortDesc: true,
      status: true,
      visitFormats: true,
      floor: true,
      parentPlaceId: true,
      placeKind: true,
      unit: true,
      unitLabel: true,
      districtAutoId: true,
      districtManualId: true,
      metroAutoId: true,
      metroManualId: true,
      metroAutoDistanceM: true,
      metroManualDistanceM: true,
      slug: true,
      shortAddress: true,
      placeGroupId: true,
      openingHoursId: true,
      createdByUserId: true,
      ownerBusinessId: true,
      images: placeImagesLight,
      ...placeGeoAndAuthor,
    },
  });
}

/** Опубликованная карточка: превью + PlaceFormData + сайдбар (нужны часы и полные изображения). */
export async function loadPlaceForPublishedAdmin(placeId: string) {
  return prisma.place.findUnique({
    where: { id: placeId },
    select: {
      id: true,
      title: true,
      cityId: true,
      lat: true,
      lng: true,
      phone: true,
      website: true,
      createdAt: true,
      updatedAt: true,
      activityTypes: true,
      addressJson: true,
      ageTags: true,
      category: true,
      countryCode: true,
      customAddress: true,
      description: true,
      formattedAddr: true,
      googlePlaceId: true,
      instagramHandle: true,
      instagramUrl: true,
      locationSource: true,
      logoImageId: true,
      shortDesc: true,
      status: true,
      visitFormats: true,
      floor: true,
      parentPlaceId: true,
      placeKind: true,
      unit: true,
      unitLabel: true,
      districtAutoId: true,
      districtManualId: true,
      metroAutoId: true,
      metroManualId: true,
      metroAutoDistanceM: true,
      metroManualDistanceM: true,
      slug: true,
      shortAddress: true,
      placeGroupId: true,
      openingHoursId: true,
      createdByUserId: true,
      ownerBusinessId: true,
      images: placeImagesForGallery,
      openingHours: openingHoursForDiff,
      ...placeGeoAndAuthor,
    },
  });
}

/** Публикация vs pending revision: те же данные place, что и для published (diff изображений и часов). */
export const loadPlaceForRevisionModeration = loadPlaceForPublishedAdmin;

const revisionOpeningHours = {
  select: {
    id: true,
    mode: true,
    timezone: true,
    note: true,
    rules: {
      include: {
        intervals: { orderBy: { sortOrder: "asc" as const } },
      },
    },
    exceptions: {
      include: {
        intervals: { orderBy: { sortOrder: "asc" as const } },
      },
    },
  },
} as const;

const revisionImagesSelect = {
  orderBy: { sortOrder: "asc" as const },
  select: {
    id: true,
    url: true,
    kind: true,
    sortOrder: true,
  },
};

/** Активная ревизия для модерации — без лишних include по сравнению с findMany всего. */
export async function loadPendingPlaceRevision(placeId: string) {
  return prisma.placeRevision.findFirst({
    where: {
      placeId,
      status: { in: ["DRAFT", "PENDING", "NEEDS_REVISION"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      placeId: true,
      status: true,
      title: true,
      category: true,
      shortDesc: true,
      description: true,
      logoImageId: true,
      googlePlaceId: true,
      lat: true,
      lng: true,
      formattedAddr: true,
      addressJson: true,
      countryCode: true,
      customAddress: true,
      districtAutoId: true,
      districtManualId: true,
      metroAutoId: true,
      metroAutoDistanceM: true,
      metroManualId: true,
      metroManualDistanceM: true,
      placeKind: true,
      parentPlaceId: true,
      unitLabel: true,
      floor: true,
      unit: true,
      phone: true,
      website: true,
      instagramHandle: true,
      instagramUrl: true,
      ageTags: true,
      visitFormats: true,
      activityTypes: true,
      createdAt: true,
      updatedAt: true,
      placeGroupId: true,
      openingHoursId: true,
      submittedAt: true,
      images: revisionImagesSelect,
      openingHours: revisionOpeningHours,
    },
  });
}

export async function loadImprovementRequestsForPlace(placeId: string) {
  return prisma.improvementRequest.findMany({
    where: {
      entityType: "PLACE",
      entityId: placeId,
    },
    select: {
      id: true,
      status: true,
      severity: true,
      title: true,
      description: true,
      dueAt: true,
      resolvedAt: true,
      createdAt: true,
      createdByModerator: {
        select: { email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
