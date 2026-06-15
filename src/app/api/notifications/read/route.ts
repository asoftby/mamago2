/**
 * PATCH /api/notifications/read
 * Батч-пометка прочитанности от read-tracker'а (viewport ≥ 3с / клик).
 *
 * Body: { ids: string[] } (1..100)
 * Идемпотентный: WHERE id IN ids AND userId = current AND readAt IS NULL.
 * Response: { updatedCount }
 */

import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { markNotificationsRead } from "@/server/notifications/notification.service";

const bodySchema = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1).max(100),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`notifications-read:${user.id}`, 60, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Слишком много запросов. Попробуйте позже." },
        { status: 429 },
      );
    }

    const { ids } = bodySchema.parse(await req.json());
    const { updatedCount } = await markNotificationsRead(user.id, ids);

    return NextResponse.json({ updatedCount });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    console.error("[PATCH /api/notifications/read]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
