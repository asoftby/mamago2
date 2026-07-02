import { NextResponse } from "next/server";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";
import { getDirectOverviewStats } from "@/server/services/direct/directAdmin.service";

export async function GET() {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;

  const stats = await getDirectOverviewStats();
  return NextResponse.json(stats);
}
