import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import { listNotificationPolicies } from "@/server/services/notificationPolicy.service";

export async function GET() {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;

  const policies = await listNotificationPolicies();

  return NextResponse.json({
    items: policies,
  });
}
