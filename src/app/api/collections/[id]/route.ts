import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { deleteCollection, renameCollection } from "@/server/services/ideaCollections.service";
import { ideaCollectionErrorResponse } from "@/server/services/ideaCollections.http";

const renameSchema = z.object({ title: z.string() });

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const parsed = renameSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "INVALID_TITLE" }, { status: 400 });

    const collection = await renameCollection(user.id, id, parsed.data.title);
    return NextResponse.json({ success: true, collection });
  } catch (error) {
    const mapped = ideaCollectionErrorResponse(error);
    if (mapped) return mapped;
    console.error("Rename collection error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    await deleteCollection(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const mapped = ideaCollectionErrorResponse(error);
    if (mapped) return mapped;
    console.error("Delete collection error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
