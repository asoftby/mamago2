import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { revalidateTag } from "next/cache";
import { STORY_INTENTS_CACHE_TAG } from "@/server/stories/storyIntentConfig";
import { handleRankingGet, handleRankingPost } from "@/server/services/ranking/adminRankingHandlers";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    return null;
  }
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  const result = await handleRankingGet(user);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  const body = await req.json();
  const { type, data } = body as { type?: "ranking" | "boost" | "intent"; data?: Record<string, unknown> };

  const result = await handleRankingPost(user, type, data);
  if (result.invalidateCache) {
    revalidateTag(STORY_INTENTS_CACHE_TAG, "max");
  }
  return NextResponse.json(result.body, { status: result.status });
}
