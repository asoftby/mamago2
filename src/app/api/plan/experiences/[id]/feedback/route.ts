import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getSessionRowIdFromCookies } from "@/lib/analytics/getSessionRowId";
import {
  ExperienceDomainError,
  serializeExperience,
  submitExperienceFeedback,
} from "@/server/services/experience/experience.service";

const requestSchema = z.object({
  sentiment: z.enum(["LIKE", "NEUTRAL", "DISLIKE"]),
}).strict();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_sentiment" }, { status: 400 });
    }
    const { id } = await context.params;
    const experience = await submitExperienceFeedback({
      userId: user.id,
      experienceId: id,
      sentiment: parsed.data.sentiment,
      sessionId: await getSessionRowIdFromCookies(),
    });
    return NextResponse.json({ experience: serializeExperience(experience) });
  } catch (error) {
    if (error instanceof ExperienceDomainError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.code === "not_found" ? 404 : 409 },
      );
    }
    console.error("[experience] feedback submission failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
