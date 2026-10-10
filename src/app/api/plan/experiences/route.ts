import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getSessionRowIdFromCookies } from "@/lib/analytics/getSessionRowId";
import {
  confirmPlanExperience,
  ExperienceDomainError,
  listAttendedExperienceVisits,
  listPendingExperienceCandidates,
  listRecentExperienceSummaries,
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

/**
 * Данные для модалки «Мой план»: что спросить («Как прошло?») и список «Где мы были».
 * `pending` — прошедшие события без ответа «были/не были»; `awaitingFeedback` —
 * подтверждённые визиты без оценки; `visits` — все подтверждённые визиты.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [pending, awaitingFeedback, visits] = await Promise.all([
      listPendingExperienceCandidates({ userId: user.id, lookbackDays: 14, take: 3 }),
      listRecentExperienceSummaries({ userId: user.id, take: 3 }),
      listAttendedExperienceVisits({ userId: user.id }),
    ]);
    return NextResponse.json({
      pending: pending.map((item) => ({
        ...item,
        plannedStartsAt: item.plannedStartsAt?.toISOString() ?? null,
      })),
      awaitingFeedback,
      visits,
      phoneVerified: Boolean(user.phoneE164 && user.phoneVerifiedAt),
    });
  } catch (error) {
    console.error("[experience] feed failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
