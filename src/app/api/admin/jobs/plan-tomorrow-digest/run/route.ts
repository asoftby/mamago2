import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import { runPlanTomorrowDigests } from "@/server/notifications/jobs/run-plan-tomorrow-digests";

export const runtime = "nodejs";

export async function POST() {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;

  const result = await runPlanTomorrowDigests();

  return NextResponse.json(result);
}
