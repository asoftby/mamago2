import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { applyMicroEdit, listMicroEditsForEntity } from "@/server/services/contentEdit.service";
import { ContentEditType } from "@prisma/client";

/**
 * GET /api/admin/places/[id]/micro-edit
 * List micro-edits for a place
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const edits = await listMicroEditsForEntity("PLACE", params.id);

    return NextResponse.json({ edits });
  } catch (error: unknown) {
    console.error("[API] List micro-edits error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/places/[id]/micro-edit
 * Apply a micro-edit to a place
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { fieldName, newValue, editType, comment } = body;

    if (!fieldName || newValue === undefined || !editType) {
      return NextResponse.json(
        { error: "Missing required fields: fieldName, newValue, editType" },
        { status: 400 }
      );
    }

    // Validate editType
    if (!Object.values(ContentEditType).includes(editType)) {
      return NextResponse.json(
        { error: `Invalid editType: ${editType}` },
        { status: 400 }
      );
    }

    const log = await applyMicroEdit({
      entityType: "PLACE",
      entityId: params.id,
      moderatorId: user.id,
      fieldName,
      newValue,
      editType,
      comment,
    });

    return NextResponse.json({ log });
  } catch (error: unknown) {
    console.error("[API] Apply micro-edit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
