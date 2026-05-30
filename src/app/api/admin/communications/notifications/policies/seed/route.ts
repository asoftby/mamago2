import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import { seedDefaultNotificationPolicies } from "@/server/services/notificationPolicy.service";

export async function POST() {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;

  try {
    const policies = await seedDefaultNotificationPolicies();
    return NextResponse.json({
      success: true,
      count: policies.length,
      items: policies,
    });
  } catch (error) {
    console.error("[admin communications notifications policies] seed failed", error);
    return NextResponse.json({ error: "Failed to seed notification policies" }, { status: 500 });
  }
}
