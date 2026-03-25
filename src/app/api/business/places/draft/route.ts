/**
 * GET /api/business/places/draft
 * Find existing draft place for current user
 * Returns the draft if found, or null if no draft exists
 * 
 * Optional: Auto-deletes stale empty drafts (>24h old with no content)
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ContentStatus } from "@prisma/client";
import { canCreateBusinessContent, canManageOwnedContent } from "@/lib/auth/businessContentAccess";

const STALE_DRAFT_HOURS = 24;

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      );
    }

    // Find existing draft
    const existingDraft = await prisma.place.findFirst({
      where: {
        ownerUserId: user.id,
        status: ContentStatus.DRAFT,
      },
      select: {
        id: true,
        title: true,
        lat: true,
        lng: true,
        createdAt: true,
        images: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc", // Get most recent draft
      },
    });

    if (!existingDraft) {
      return NextResponse.json({ draft: null });
    }

    // Check if draft is stale and empty
    const isStale = isStaleEmptyDraft(existingDraft);

    if (isStale) {
      console.log(`[draft] Deleting stale empty draft: ${existingDraft.id}`);
      
      // Delete stale draft
      await prisma.place.delete({
        where: { id: existingDraft.id },
      });

      return NextResponse.json({ draft: null });
    }

    // Return existing draft
    return NextResponse.json({
      draft: {
        id: existingDraft.id,
        title: existingDraft.title,
      },
    });
  } catch (error) {
    console.error("[draft] ❌ Error:", error);
    console.error("[draft] Stack:", error instanceof Error ? error.stack : "No stack");

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to check draft",
      },
      { status: 500 }
    );
  }
}

/**
 * Check if draft is stale and empty
 * Stale = older than 24 hours
 * Empty = no title (or default title) AND no location AND no images
 */
function isStaleEmptyDraft(draft: {
  title: string;
  lat: number | null;
  lng: number | null;
  createdAt: Date;
  images: Array<{ id: string }>;
}): boolean {
  const now = new Date();
  const ageHours = (now.getTime() - draft.createdAt.getTime()) / (1000 * 60 * 60);

  // Not old enough
  if (ageHours < STALE_DRAFT_HOURS) {
    return false;
  }

  // Has location
  if (draft.lat !== null && draft.lng !== null) {
    return false;
  }

  // Has images
  if (draft.images.length > 0) {
    return false;
  }

  // Has custom title (not default)
  const hasCustomTitle = draft.title && 
    draft.title !== "Новое место" && 
    draft.title.trim().length > 0;

  if (hasCustomTitle) {
    return false;
  }

  // Draft is stale and empty
  return true;
}
