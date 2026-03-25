/**
 * GET /api/business/places/[id]/revision
 * Get or create active revision for a published Place
 * 
 * PATCH /api/business/places/[id]/revision
 * Save revision draft
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import {
  getOrCreatePlaceRevision,
  savePlaceRevisionDraft,
  PlaceRevisionData,
} from "@/server/services/placeRevision.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: placeId } = await params;
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get or create revision
    try {
      const revision = await getOrCreatePlaceRevision(placeId, user);
      return NextResponse.json({ revision });
    } catch (serviceError) {
      const message = serviceError instanceof Error ? serviceError.message : "Failed to get revision";
      
      // Map service errors to appropriate HTTP status codes
      if (message.includes("not found")) {
        return NextResponse.json({ error: message }, { status: 404 });
      }
      if (message.includes("Unauthorized") || message.includes("not place owner")) {
        return NextResponse.json({ error: message }, { status: 403 });
      }
      if (message.includes("only create revisions for published")) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } catch (error) {
    console.error("Get revision error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: placeId } = await params;
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { revisionId, data } = body;

    if (!revisionId) {
      return NextResponse.json(
        { error: "revisionId is required" },
        { status: 400 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "data is required" },
        { status: 400 }
      );
    }

    // Save revision draft
    try {
      const updatedRevision = await savePlaceRevisionDraft(
        revisionId,
        data as PlaceRevisionData,
        user
      );
      return NextResponse.json({ revision: updatedRevision });
    } catch (serviceError) {
      const message = serviceError instanceof Error ? serviceError.message : "Failed to save revision";
      
      // Map service errors to appropriate HTTP status codes
      if (message.includes("not found")) {
        return NextResponse.json({ error: message }, { status: 404 });
      }
      if (message.includes("Unauthorized") || message.includes("not place owner")) {
        return NextResponse.json({ error: message }, { status: 403 });
      }
      if (message.includes("Cannot edit revision")) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } catch (error) {
    console.error("Save revision error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
