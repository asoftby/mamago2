/**
 * POST /api/business/temp-media
 * Upload temporary media for wizard session (before Place/Activity creation)
 * 
 * GET /api/business/temp-media?wizardSessionId=...
 * Get all temp media for a wizard session
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { TempMediaKind, TempMediaStatus } from "@prisma/client";
import { canCreateBusinessContent, canManageOwnedContent } from "@/lib/auth/businessContentAccess";

/**
 * POST - Upload temporary media
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      console.error("[temp-media] Unauthorized access attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("[temp-media] POST request:", {
      userId: user.id,
      wizardSessionId: body.wizardSessionId,
      kind: body.kind,
      hasUrl: !!body.url,
    });

    const {
      wizardSessionId,
      url,
      width,
      height,
      blurhash,
      mimeType,
      sizeBytes,
      kind,
      sortOrder,
    } = body;

    // Validate required fields
    if (!wizardSessionId || !url || !kind) {
      console.error("[temp-media] Missing required fields:", {
        hasWizardSessionId: !!wizardSessionId,
        hasUrl: !!url,
        hasKind: !!kind,
      });
      return NextResponse.json(
        { error: "wizardSessionId, url, and kind are required" },
        { status: 400 }
      );
    }

    // Validate kind
    if (!Object.values(TempMediaKind).includes(kind)) {
      console.error("[temp-media] Invalid kind:", kind);
      return NextResponse.json(
        { error: "Invalid kind" },
        { status: 400 }
      );
    }

    // If kind is PLACE_LOGO, remove existing logo for this session
    if (kind === "PLACE_LOGO") {
      await prisma.tempMedia.updateMany({
        where: {
          ownerUserId: user.id,
          wizardSessionId,
          kind: "PLACE_LOGO",
          status: "TEMP",
        },
        data: {
          status: "DELETED",
        },
      });
    }

    // Get next sort order if not provided
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined) {
      const lastMedia = await prisma.tempMedia.findFirst({
        where: {
          ownerUserId: user.id,
          wizardSessionId,
          kind,
          status: "TEMP",
        },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      finalSortOrder = (lastMedia?.sortOrder || 0) + 1;
    }

    // Create temp media
    const media = await prisma.tempMedia.create({
      data: {
        ownerUserId: user.id,
        wizardSessionId,
        url,
        width: width || null,
        height: height || null,
        blurhash: blurhash || null,
        mimeType: mimeType || null,
        sizeBytes: sizeBytes || null,
        kind,
        sortOrder: finalSortOrder,
        status: "TEMP",
      },
    });

    console.log("[temp-media] Created temp media:", media.id);
    return NextResponse.json({ media });
  } catch (error) {
    console.error("[temp-media] Upload temp media error:", error);
    console.error("[temp-media] Error stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET - Get all temp media for wizard session
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const wizardSessionId = searchParams.get("wizardSessionId");

    if (!wizardSessionId) {
      return NextResponse.json(
        { error: "wizardSessionId is required" },
        { status: 400 }
      );
    }

    const media = await prisma.tempMedia.findMany({
      where: {
        ownerUserId: user.id,
        wizardSessionId,
        status: "TEMP",
      },
      orderBy: [
        { kind: "asc" },
        { sortOrder: "asc" },
      ],
    });

    return NextResponse.json({ media });
  } catch (error) {
    console.error("Get temp media error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
