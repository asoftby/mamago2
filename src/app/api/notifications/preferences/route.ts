/**
 * Legacy USER-surface adapter.
 *
 * GET  /api/notifications/preferences  — list effective preferences for the
 * current user's personal notification surface.
 * POST /api/notifications/preferences  — upsert one personal preference override.
 *
 * Canonical in-app settings reads/writes should prefer
 * `/api/notifications/settings?surface=user`.
 *
 * This route is intentionally kept as a compatibility layer for old clients
 * and bookmarks until manual QA and post-release cleanup confirm it is safe to retire.
 */

import { NextRequest, NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";
import { z } from "zod";
import { resolveSettingsContext } from "@/lib/settings/resolveSettingsContext";
import { isNotificationTypeSupportedOnSurface } from "@/lib/notifications/settingsDomain";
import {
  getLegacyNotificationPreferencesForSurface,
  updateNotificationSettingsValues,
} from "@/server/services/notificationSettings.service";
import { getTelegramLinkStatus } from "@/server/services/telegramLink.service";
import { isLegacyUserNotificationType } from "@/lib/notifications/userNotificationEvents";

const VALID_TYPES = new Set<string>(Object.values(NotificationType));

const updateSchema = z.object({
  notificationType: z.string().refine((value) => VALID_TYPES.has(value), {
    message: "Invalid notificationType",
  }),
  inAppEnabled: z.boolean().nullable().optional(),
  emailEnabled: z.boolean().nullable().optional(),
  telegramEnabled: z.boolean().nullable().optional(),
});

export async function GET() {
  const context = await resolveSettingsContext({ requestedScope: "USER" });
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const preferences = await getLegacyNotificationPreferencesForSurface(
    context.viewer.id,
    "USER",
  );
  return NextResponse.json({ preferences });
}

export async function POST(req: NextRequest) {
  const context = await resolveSettingsContext({ requestedScope: "USER" });
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const notificationType = parsed.data.notificationType as NotificationType;
  if (!isNotificationTypeSupportedOnSurface("USER", notificationType)) {
    return NextResponse.json({ error: "Invalid notificationType" }, { status: 400 });
  }

  // Reject writes for legacy-only USER types (WELCOME, ANNOUNCEMENT).
  if (isLegacyUserNotificationType(notificationType)) {
    return NextResponse.json({ error: "Invalid notificationType" }, { status: 400 });
  }

  if (parsed.data.telegramEnabled === true) {
    const telegramStatus = await getTelegramLinkStatus({ userId: context.viewer.id });
    if (!telegramStatus.linked) {
      return NextResponse.json(
        { error: "Telegram is not connected" },
        { status: 400 },
      );
    }
  }

  await updateNotificationSettingsValues({
    userId: context.viewer.id,
    surface: "USER",
    notificationType,
    values: {
      inAppEnabled: parsed.data.inAppEnabled,
      emailEnabled: parsed.data.emailEnabled,
      telegramEnabled: parsed.data.telegramEnabled,
    },
  });

  return NextResponse.json({ ok: true });
}
