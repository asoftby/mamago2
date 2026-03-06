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

  // Get latest moderation message if status is NEEDS_CHANGES or REJECTED
  let moderationMessage: string | null = null;
  if (place.status === "NEEDS_CHANGES" || place.status === "REJECTED") {
    moderationMessage = await getLatestModerationMessage("PLACE", place.id);
  }

  const step = parseInt(stepParam || "1", 10);

  return <PlaceWizard place={place} initialStep={step} moderationMessage={moderationMessage} />;
}
