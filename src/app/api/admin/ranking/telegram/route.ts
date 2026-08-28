import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import {
  RecommendationPolicyConflictError,
  getTelegramRecommendationPolicyState,
  publishTelegramRecommendationPolicy,
  saveTelegramRecommendationPolicyDraft,
} from "@/server/services/recommendations/telegramRecommendationAdmin";

export async function GET() {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;

  const state = await getTelegramRecommendationPolicyState();
  return NextResponse.json(state);
}

export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;

  let body: {
    action?: "save-draft" | "publish";
    config?: unknown;
    expectedUpdatedAt?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (body.action === "save-draft") {
      const draft = await saveTelegramRecommendationPolicyDraft({
        actor: auth,
        config: body.config,
        expectedUpdatedAt: body.expectedUpdatedAt,
      });
      return NextResponse.json({ draft });
    }

    if (body.action === "publish") {
      const published = await publishTelegramRecommendationPolicy({
        actor: auth,
        config: body.config,
        expectedUpdatedAt: body.expectedUpdatedAt,
      });
      return NextResponse.json({ published });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof RecommendationPolicyConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[admin-ranking-telegram] policy mutation failed", error);
    return NextResponse.json({ error: "Failed to update Telegram recommendation policy" }, { status: 500 });
  }
}
