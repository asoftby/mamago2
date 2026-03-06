/**
 * POST /api/business/places/[id]/revision/submit
 * Submit revision for moderation
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { submitPlaceRevisionForModeration } from "@/server/services/placeRevision.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: placeId } = await params;
    const user = await getCurrentUser();

    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { revisionId } = body;

    if (!revisionId) {
      return NextResponse.json(
        { error: "revisionId is required" },
        { status: 400 }
      );
    }

    // Submit revision
    try {
      const submittedRevision = await submitPlaceRevisionForModeration(
        revisionId,
        user.id
      );
      return NextResponse.json({
        success: true,
        revision: submittedRevision,
      });
    } catch (serviceError) {
      const message = serviceError instanceof Error ? serviceError.message : "Failed to submit revision";
      
      // Map service errors to appropriate HTTP status codes
      if (message.includes("not found")) {
        return NextResponse.json({ error: message }, { status: 404 });
      }
      if (message.includes("Unauthorized") || message.includes("not place owner")) {
        return NextResponse.json({ error: message }, { status: 403 });
      }
      if (message.includes("Cannot submit revision")) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } catch (error) {
    console.error("Submit revision error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
