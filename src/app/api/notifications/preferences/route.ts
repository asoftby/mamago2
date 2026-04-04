/**
 * GET  /api/notifications/preferences  — list all preferences for current user
 * POST /api/notifications/preferences  — upsert one preference override
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import {
  getPreferences,
  updatePreference,
} from "@/server/services/notificationPreference.service";
import { NotificationType } from "@prisma/client";

const VALID_TYPES = new Set<string>(Object.values(NotificationType));

const updateSchema = z.object({
  notificationType: z.string().refine((v) => VALID_TYPES.has(v), {
    message: "Invalid notificationType",
  }),
  inAppEnabled:    z.boolean().nullable().optional(),
  emailEnabled:    z.boolean().nullable().optional(),
  telegramEnabled: z.boolean().nullable().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const preferences = await getPreferences(user.id, user.role);
  return NextResponse.json({ preferences });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { notificationType, ...values } = parsed.data;

  await updatePreference(
    user.id,                              // always current user — no spoofing
    notificationType as NotificationType,
    values,
  );

  return NextResponse.json({ ok: true });
}
