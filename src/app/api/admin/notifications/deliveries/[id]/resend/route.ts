import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import { resendNotificationDelivery } from "@/server/services/notificationDelivery.service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const ok = await resendNotificationDelivery(id);

  return NextResponse.json({ ok });
}
