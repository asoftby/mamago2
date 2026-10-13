import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import {
  getIdeaCollectionIds,
  parseIdeaTarget,
  setIdeaCollections,
} from "@/server/services/ideaCollections.service";
import { ideaCollectionErrorResponse } from "@/server/services/ideaCollections.http";

const putSchema = z
  .object({
    activityId: z.string().optional(),
    offerId: z.string().optional(),
    routeId: z.string().optional(),
    placeId: z.string().optional(),
    articleId: z.string().optional(),
    collectionIds: z.array(z.string().min(1)).max(50),
  })
  .passthrough();

/** В каких коллекциях лежит идея (для галочек на шаге 2). Несохранённая → []. */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const target = parseIdeaTarget(new URL(request.url).searchParams);
    if (!target) return NextResponse.json({ error: "activityId, offerId, routeId, placeId or articleId is required" }, { status: 400 });
    return NextResponse.json({ collectionIds: await getIdeaCollectionIds(user.id, target) });
  } catch (error) {
    console.error("Get idea collections error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Полный набор коллекций идеи («В коллекцию», перенос). Чужая идея/коллекция → 404. */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = putSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    const target = parseIdeaTarget(parsed.data);
    if (!target) return NextResponse.json({ error: "activityId, offerId, routeId, placeId or articleId is required" }, { status: 400 });

    const collectionIds = await setIdeaCollections(user.id, target, parsed.data.collectionIds);
    return NextResponse.json({ success: true, collectionIds });
  } catch (error) {
    const mapped = ideaCollectionErrorResponse(error);
    if (mapped) return mapped;
    console.error("Set idea collections error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
