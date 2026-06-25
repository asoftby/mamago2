import prisma from "@/lib/prisma";

const placeInclude = {
  images: {
    orderBy: { sortOrder: "asc" as const },
  },
  subcategories: {
    orderBy: { position: "asc" as const },
  },
  openingHours: {
    include: {
      rules: {
        include: {
          intervals: {
            orderBy: { sortOrder: "asc" as const },
          },
        },
      },
      exceptions: {
        include: {
          intervals: {
            orderBy: { sortOrder: "asc" as const },
          },
        },
      },
    },
  },
} as const;

export async function loadPlaceForWizard(placeId: string) {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    include: placeInclude,
  });

  if (!place) {
    return { place: null, placeForWizard: null, activeRevision: null };
  }

  let activeRevision = null;
  if (place.status === "PUBLISHED") {
    activeRevision = await prisma.placeRevision.findFirst({
      where: {
        placeId: place.id,
        status: {
          in: ["DRAFT", "PENDING", "NEEDS_REVISION"],
        },
      },
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
        },
        openingHours: {
          include: {
            rules: {
              include: {
                intervals: {
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
            exceptions: {
              include: {
                intervals: {
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
      },
    });
  }

  const placeForWizard = activeRevision
    ? {
        ...place,
        phone: activeRevision.phone,
        phoneLabel: activeRevision.phoneLabel,
        phone2: activeRevision.phone2,
        phone2Label: activeRevision.phone2Label,
        phone3: activeRevision.phone3,
        phone3Label: activeRevision.phone3Label,
        website: activeRevision.website,
        instagramHandle: activeRevision.instagramHandle,
        instagramUrl: activeRevision.instagramUrl,
        reelsUrl: activeRevision.reelsUrl,
        images: activeRevision.images,
        placeGroupId:
          activeRevision.placeGroupId !== undefined ? activeRevision.placeGroupId : place.placeGroupId,
        openingHours: activeRevision.openingHours || place.openingHours,
      }
    : place;

  return { place, placeForWizard, activeRevision };
}
