import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { PlaceModerationView } from "@/components/admin/PlaceModerationView";
import { PlaceRevisionModerationView } from "@/components/admin/PlaceRevisionModerationView";

export default async function PlaceModerationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    redirect("/login");
  }

  const { id } = await params;
  const { mode } = await searchParams;

  // Get place with all relations
  const place = await prisma.place.findUnique({
    where: { id },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
      city: {
        select: {
          id: true,
          name: true,
          hasMetro: true,
          metroMaxDistanceM: true,
        },
      },
      districtAuto: {
        select: {
          name: true,
        },
      },
      districtManual: {
        select: {
          name: true,
        },
      },
      metroAuto: {
        select: {
          name: true,
        },
      },
      metroManual: {
        select: {
          name: true,
        },
      },
      owner: {
        select: {
          id: true,
          email: true,
          business: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!place) {
    notFound();
  }

  // Check if we should show revision mode
  const shouldShowRevision = mode === "revision" || place.status === "PUBLISHED";

  if (shouldShowRevision) {
    // Get active revision
    const revision = await prisma.placeRevision.findFirst({
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
      },
    });

    if (revision && revision.status === "PENDING") {
      // Show revision moderation view
      return <PlaceRevisionModerationView place={place} revision={revision} />;
    }
  }

  // Show regular place moderation view
  return <PlaceModerationView place={place} />;
}
