/**
 * Canonical notification settings endpoint.
 *
 * Surface-specific settings UIs should use this route with `surface=user|business|admin`.
 * Legacy `/api/notifications/preferences` remains only as a USER compatibility adapter.
 */

import { NextRequest, NextResponse } from "next/server";
import { NotificationChannel, NotificationType } from "@prisma/client";
import { z } from "zod";
import { resolveSettingsContext } from "@/lib/settings/resolveSettingsContext";
import type { SettingsScope } from "@/lib/settings/types";
import {
  isNotificationTypeSupportedOnSurface,
  type NotificationSettingsSurface,
} from "@/lib/notifications/settingsDomain";
import {
  getNotificationSettingsSurfaceData,
  NotificationSettingsValidationError,
  updateNotificationSettingsChannelValue,
} from "@/server/services/notificationSettings.service";
import { getTelegramLinkStatus } from "@/server/services/telegramLink.service";
import { isLegacyUserNotificationType } from "@/lib/notifications/userNotificationEvents";

const VALID_SURFACES = new Set<NotificationSettingsSurface>(["USER", "BUSINESS", "ADMIN"]);

const patchSchema = z.object({
  notificationType: z.string().refine(
    (value) => value in NotificationType,
    { message: "Invalid notificationType" },
  ),
  channel: z.nativeEnum(NotificationChannel),
  enabled: z.boolean(),
});

function parseSurface(raw: string | null): NotificationSettingsSurface {
  if (!raw) return "BUSINESS";

  const normalized = raw.toUpperCase();
  if (VALID_SURFACES.has(normalized as NotificationSettingsSurface)) {
    return normalized as NotificationSettingsSurface;
  }

  return "BUSINESS";
}

function canAccessSurface(
  requestedScope: SettingsScope,
  permissions: {
    canAccessBusinessSettings: boolean;
    canAccessAdminSettings: boolean;
  },
): boolean {
  if (requestedScope === "BUSINESS") return permissions.canAccessBusinessSettings;
  if (requestedScope === "ADMIN") return permissions.canAccessAdminSettings;
  return true;
}

export async function GET(req: NextRequest) {
  const surface = parseSurface(req.nextUrl.searchParams.get("surface"));
  const context = await resolveSettingsContext({ requestedScope: surface });

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessSurface(surface, context.permissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getNotificationSettingsSurfaceData(context.viewer.id, surface);
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const surface = parseSurface(req.nextUrl.searchParams.get("surface"));
  const context = await resolveSettingsContext({ requestedScope: surface });

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessSurface(surface, context.permissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const notificationType = parsed.data.notificationType as NotificationType;
  if (!isNotificationTypeSupportedOnSurface(surface, notificationType)) {
    return NextResponse.json({ error: "Invalid notificationType" }, { status: 400 });
  }

  // Reject writes for legacy-only USER types (WELCOME, ANNOUNCEMENT).
  // These are read-only compatibility inputs — new preferences must use active types.
  if (surface === "USER" && isLegacyUserNotificationType(notificationType)) {
    return NextResponse.json(
      { error: "Invalid notificationType" },
      { status: 400 },
    );
  }

  if (
    parsed.data.channel === NotificationChannel.TELEGRAM &&
    !(await getTelegramLinkStatus({ userId: context.viewer.id })).linked
  ) {
    return NextResponse.json(
      { error: "Telegram is not connected" },
      { status: 400 },
    );
  }

  try {
    await updateNotificationSettingsChannelValue({
      userId: context.viewer.id,
      surface,
      notificationType,
      channel: parsed.data.channel,
      enabled: parsed.data.enabled,
    });
  } catch (error) {
    if (error instanceof NotificationSettingsValidationError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 400 },
      );
    }

    throw error;
  }

  return NextResponse.json({ ok: true });
}
