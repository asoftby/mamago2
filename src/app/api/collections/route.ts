import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { createCollection, listCollections } from "@/server/services/ideaCollections.service";
import { ideaCollectionErrorResponse } from "@/server/services/ideaCollections.http";

const CREATE_LIMIT_PER_HOUR = 20;

const createSchema = z.object({
  title: z.string(),
  activityId: z.string().trim().min(1).optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ collections: await listCollections(user.id) });
  } catch (error) {
    console.error("List collections error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "INVALID_TITLE" }, { status: 400 });

    const rate = await checkRateLimit(`collection_create:${user.id}`, CREATE_LIMIT_PER_HOUR, 60 * 60 * 1000);
    if (!rate.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const collection = await createCollection(user.id, parsed.data.title, { activityId: parsed.data.activityId });
    return NextResponse.json({ success: true, collection }, { status: 201 });
  } catch (error) {
    const mapped = ideaCollectionErrorResponse(error);
    if (mapped) return mapped;
    console.error("Create collection error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
