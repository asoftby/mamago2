import { NextResponse } from "next/server";

import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import { getOperationsView } from "@/server/ops/read/getOperationsView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Smallest authenticated admin read endpoint exposing the Operations
 * Center backend read contract (§21 Step 2, Phase P). No UI, no
 * acknowledge/snooze/resolve — those are Step 3+.
 */
export async function GET() {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;

  const view = await getOperationsView(auth.id);
  return NextResponse.json(view);
}
