import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import { updateNotificationPolicy } from "@/server/services/notificationPolicy.service";

type RouteParams = Promise<{ id: string }>;

export async function PATCH(
  req: NextRequest,
  { params }: { params: RouteParams },
) {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const policy = await updateNotificationPolicy({
      id,
      input: {
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        allowedInApp: typeof body.allowedInApp === "boolean" ? body.allowedInApp : undefined,
        allowedEmail: typeof body.allowedEmail === "boolean" ? body.allowedEmail : undefined,
        allowedTelegram: typeof body.allowedTelegram === "boolean" ? body.allowedTelegram : undefined,
        defaultInApp: typeof body.defaultInApp === "boolean" ? body.defaultInApp : undefined,
        defaultEmail: typeof body.defaultEmail === "boolean" ? body.defaultEmail : undefined,
        defaultTelegram: typeof body.defaultTelegram === "boolean" ? body.defaultTelegram : undefined,
        minCooldownMinutes:
          typeof body.minCooldownMinutes === "number" ? body.minCooldownMinutes : body.minCooldownMinutes === null ? null : undefined,
        maxPerDay:
          typeof body.maxPerDay === "number" ? body.maxPerDay : body.maxPerDay === null ? null : undefined,
        quietHoursEnabled:
          typeof body.quietHoursEnabled === "boolean" ? body.quietHoursEnabled : undefined,
        quietHoursStart:
          typeof body.quietHoursStart === "string" ? body.quietHoursStart : body.quietHoursStart === null ? null : undefined,
        quietHoursEnd:
          typeof body.quietHoursEnd === "string" ? body.quietHoursEnd : body.quietHoursEnd === null ? null : undefined,
        digestTime:
          typeof body.digestTime === "string" ? body.digestTime : body.digestTime === null ? null : undefined,
        defaultReminderOffsetMinutes:
          typeof body.defaultReminderOffsetMinutes === "number"
            ? body.defaultReminderOffsetMinutes
            : body.defaultReminderOffsetMinutes === null
              ? null
              : undefined,
        availableReminderOffsets: Array.isArray(body.availableReminderOffsets)
          ? body.availableReminderOffsets.filter((value): value is number => typeof value === "number")
          : undefined,
        description:
          typeof body.description === "string" ? body.description : body.description === null ? null : undefined,
      },
    });

    return NextResponse.json({ item: policy });
  } catch (error) {
    console.error("[admin communications notifications policies] patch failed", error);
    return NextResponse.json({ error: "Failed to update notification policy" }, { status: 500 });
  }
}
