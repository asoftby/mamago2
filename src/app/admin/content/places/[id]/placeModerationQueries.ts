import prisma from "@/lib/prisma";

/** Часы работы: та же форма, что раньше у include, но без лишних полей у интервалов при возможности — сравнение в diff идёт по JSON. */
const openingHoursForDiff = {
  select: {
    id: true,
    createdAt: true,
    updatedAt: true,
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
  ownerBusiness: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

const publishedReviewsPreview = {
  where: {
    status: "PUBLISHED" as const,
  },
  orderBy: {
    createdAt: "desc" as const,
  },
  take: 5,
};

/** Скаляры + связи для модерации новых мест. */
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
      phoneLabel: true,
      phone2: true,
      phone2Label: true,
      phone3: true,
      phone3Label: true,
      website: true,
      bookingEnabled: true,
      bookingPhone: true,
      bookingNote: true,
      createdAt: true,
      updatedAt: true,
      activityTypes: true,
      addressJson: true,
      ageTags: true,
      category: true,
      countryCode: true,
      customAddress: true,
      displayAddress: true,
      description: true,
      directionsNote: true,
      formattedAddr: true,
      googlePlaceId: true,
      googleRating: true,
      googleUserRatingsTotal: true,
      googleReviewsJson: true,
      instagramHandle: true,
      instagramUrl: true,
      reelsUrl: true,
      locationName: true,
      locationSource: true,
      logoImageId: true,
      shortDesc: true,
      status: true,
      visitFormats: true,
      faqItems: true,
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
      primaryCategoryId: true,
      images: placeImagesLight,
      openingHours: openingHoursForDiff,
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
      phoneLabel: true,
      phone2: true,
      phone2Label: true,
      phone3: true,
      phone3Label: true,
      website: true,
      bookingEnabled: true,
      bookingPhone: true,
      bookingNote: true,
      createdAt: true,
      updatedAt: true,
      activityTypes: true,
      addressJson: true,
      ageTags: true,
      category: true,
      countryCode: true,
      customAddress: true,
      displayAddress: true,
      description: true,
      directionsNote: true,
      formattedAddr: true,
      googlePlaceId: true,
      googleRating: true,
      googleUserRatingsTotal: true,
      googleReviewsJson: true,
      instagramHandle: true,
      instagramUrl: true,
      reelsUrl: true,
      locationName: true,
      locationSource: true,
      logoImageId: true,
      shortDesc: true,
      status: true,
      visitFormats: true,
      faqItems: true,
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
      primaryCategoryId: true,
      images: placeImagesForGallery,
      openingHours: openingHoursForDiff,
      reviews: publishedReviewsPreview,
      _count: {
        select: {
          reviews: true,
        },
      },
      ...placeGeoAndAuthor,
    },
  });
}

/** Публикация vs pending revision: те же данные place, что и для published (diff изображений и часов). */
export const loadPlaceForRevisionModeration = loadPlaceForPublishedAdmin;

const revisionOpeningHours = {
  select: {
    id: true,
    createdAt: true,
    updatedAt: true,
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
  const revision = await prisma.placeRevision.findFirst({
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
      displayAddress: true,
      formattedAddr: true,
      addressJson: true,
      directionsNote: true,
      countryCode: true,
      customAddress: true,
      locationName: true,
      cityId: true,
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
      phoneLabel: true,
      phone2: true,
      phone2Label: true,
      phone3: true,
      phone3Label: true,
      website: true,
      instagramHandle: true,
      instagramUrl: true,
      reelsUrl: true,
      ageTags: true,
      visitFormats: true,
      faqItems: true,
      activityTypes: true,
      createdAt: true,
      updatedAt: true,
      placeGroupId: true,
      openingHoursId: true,
      moderatorComment: true,
      submittedAt: true,
      reviewedAt: true,
      revisionRequestedAt: true,
      revisionResubmittedAt: true,
      images: revisionImagesSelect,
      openingHours: revisionOpeningHours,
      city: {
        select: { id: true, name: true },
      },
    },
  });

  if (!revision) {
    return null;
  }

  const [districtAuto, districtManual, metroAuto, metroManual] = await Promise.all([
    revision.districtAutoId
      ? prisma.district.findUnique({
          where: { id: revision.districtAutoId },
          select: { name: true },
        })
      : null,
    revision.districtManualId
      ? prisma.district.findUnique({
          where: { id: revision.districtManualId },
          select: { name: true },
        })
      : null,
    revision.metroAutoId
      ? prisma.metroStation.findUnique({
          where: { id: revision.metroAutoId },
          select: { name: true },
        })
      : null,
    revision.metroManualId
      ? prisma.metroStation.findUnique({
          where: { id: revision.metroManualId },
          select: { name: true },
        })
      : null,
  ]);

  return {
    ...revision,
    districtAuto,
    districtManual,
    metroAuto,
    metroManual,
  };
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
