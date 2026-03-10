/**
 * Place Wizard - Edit Place (unified)
 */

import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { PlaceWizard } from "@/components/business/wizard/place/PlaceWizard";
import { canEditPlace } from "@/lib/permissions/placeEditPermissions";

export default async function EditPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  // Get place with images and opening hours
  const place = await prisma.place.findUnique({
    where: { id },
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

  if (!place) {
    notFound();
  }

  // Check edit permissions
  if (!canEditPlace(user, {
    placeId: place.id,
    ownerUserId: place.ownerUserId,
    status: place.status,
  })) {
    if (user.role === "BUSINESS_OWNER") {
      redirect("/business/places");
    } else {
      redirect("/login");
    }
  }

  // Get active revision if Place is PUBLISHED
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

  // If there's an active revision, use its data
  const placeForWizard = activeRevision
    ? { 
        ...place, 
        images: activeRevision.images,
        placeGroupId: activeRevision.placeGroupId !== undefined 
          ? activeRevision.placeGroupId 
          : place.placeGroupId,
        openingHours: activeRevision.openingHours || place.openingHours,
      }
    : place;

  return (
    <PlaceWizard
      mode="edit"
      place={placeForWizard}
      userId={user.id}
    />
  );
}
