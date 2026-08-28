import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import { previewTelegramRecommendations } from "@/server/services/recommendations/telegramRecommendationAdmin";

export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;
  void auth;

  let body: {
    config?: unknown;
    citySlug?: unknown;
    dateFrom?: unknown;
    ageRanges?: unknown;
    userEmail?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const preview = await previewTelegramRecommendations({
      config: body.config,
      citySlug: body.citySlug,
      dateFrom: body.dateFrom,
      ageRanges: body.ageRanges,
      userEmail: body.userEmail,
    });
    return NextResponse.json(preview);
  } catch (error) {
    console.error("[admin-ranking-telegram] preview failed", error);
    return NextResponse.json({ error: "Failed to build Telegram recommendation preview" }, { status: 500 });
  }
}
