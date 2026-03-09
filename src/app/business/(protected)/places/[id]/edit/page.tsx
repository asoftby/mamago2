/**
 * Place Wizard - Edit Place in 4 steps
 */

import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { PlaceWizard } from "./PlaceWizard";
import { getLatestModerationMessage } from "@/server/services/moderation.service";

export default async function EditPlacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== "BUSINESS_OWNER") {
    redirect("/login");
  }

  const { id } = await params;
  const { step: stepParam } = await searchParams;

  // Get place with images
  const place = await prisma.place.findUnique({
    where: { id },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!place) {
    notFound();
  }

  // Check ownership
  if (place.ownerUserId !== user.id) {
    redirect("/business/places");
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
      },
    });
  }

  // Get latest moderation message
  let moderationMessage: string | null = null;
  if (place.status === "NEEDS_REVISION" || place.status === "REJECTED") {
    moderationMessage = await getLatestModerationMessage("PLACE", place.id);
  } else if (activeRevision && (activeRevision.status === "NEEDS_REVISION")) {
    // Get moderation message from revision
    moderationMessage = activeRevision.moderatorComment;
  }

  const step = parseInt(stepParam || "1", 10);

  // If there's an active revision, use its images instead of place images
  // This ensures the wizard shows draft photos, not published photos
  const placeForWizard = activeRevision
    ? { ...place, images: activeRevision.images }
    : place;

  return (
    <PlaceWizard
      place={placeForWizard}
      initialStep={step}
      moderationMessage={moderationMessage}
      activeRevision={activeRevision}
    />
  );
}
