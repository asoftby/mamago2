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
import { TempMediaKind } from "@prisma/client";
import { checkBusinessToolPermission } from "@/server/permissions/business-permissions";

async function requireTempMediaAccess() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }
  if (!(await checkBusinessToolPermission(user, "content.create"))) {
    return { user: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, response: null };
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireTempMediaAccess();
    if (!access.user) return access.response!;
    const user = access.user;

    const body = await req.json();
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

    if (!wizardSessionId || !url || !kind) {
      return NextResponse.json(
        { error: "wizardSessionId, url, and kind are required" },
        { status: 400 },
      );
    }

    if (!Object.values(TempMediaKind).includes(kind)) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }

    if (kind === "PLACE_LOGO") {
      await prisma.tempMedia.updateMany({
        where: {
          ownerUserId: user.id,
          wizardSessionId,
          kind: "PLACE_LOGO",
          status: "TEMP",
        },
        data: { status: "DELETED" },
      });
    }

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

    return NextResponse.json({ media });
  } catch (error) {
    console.error("[temp-media] Upload temp media error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireTempMediaAccess();
    if (!access.user) return access.response!;
    const user = access.user;

    const { searchParams } = new URL(req.url);
    const wizardSessionId = searchParams.get("wizardSessionId");
    if (!wizardSessionId) {
      return NextResponse.json({ error: "wizardSessionId is required" }, { status: 400 });
    }

    const media = await prisma.tempMedia.findMany({
      where: {
        ownerUserId: user.id,
        wizardSessionId,
        status: "TEMP",
      },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
    });

    return NextResponse.json({ media });
  } catch (error) {
    console.error("Get temp media error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
