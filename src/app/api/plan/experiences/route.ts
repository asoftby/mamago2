import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getSessionRowIdFromCookies } from "@/lib/analytics/getSessionRowId";
import {
  confirmPlanExperience,
  ExperienceDomainError,
  serializeExperience,
} from "@/server/services/experience/experience.service";

const requestSchema = z.object({
  planItemId: z.string().min(1).max(128),
  attendance: z.enum(["ATTENDED", "NOT_ATTENDED"]),
}).strict();

function domainResponse(error: ExperienceDomainError) {
  const status = error.code === "not_found" ? 404 : 409;
  return NextResponse.json({ error: error.code }, { status });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    const experience = await confirmPlanExperience({
      userId: user.id,
      planItemId: parsed.data.planItemId,
      attendance: parsed.data.attendance,
      sessionId: await getSessionRowIdFromCookies(),
    });
    return NextResponse.json({ experience: serializeExperience(experience) });
  } catch (error) {
    if (error instanceof ExperienceDomainError) return domainResponse(error);
    console.error("[experience] attendance confirmation failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
