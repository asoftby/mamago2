import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import {
  correctUnratedExperienceAttendance,
  ExperienceDomainError,
  serializeExperience,
} from "@/server/services/experience/experience.service";

const bodySchema = z.object({ attendance: z.literal("NOT_ATTENDED") }).strict();

/** Correct an unreviewed attendance, never change someone else's record. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const { id } = await context.params;
  if (!id || id.length > 128) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const experience = await correctUnratedExperienceAttendance({
      userId: user.id,
      experienceId: id,
    });
    return NextResponse.json({ experience: serializeExperience(experience) });
  } catch (error) {
    if (error instanceof ExperienceDomainError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.code === "not_found" ? 404 : 409 },
      );
    }
    console.error("[experience] attendance correction failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
