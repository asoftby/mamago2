import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { activeFamilyUserIds } from "@/server/family/familyAccess";
import { familyReadsEnabled } from "@/server/family/familyScope";

/**
 * Family Core M4c: does this user share a plan with another adult? Drives the
 * "Видно семье" switch in the add-to-plan sheet. No family data is returned.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !familyReadsEnabled()) {
    return NextResponse.json({ sharedPlan: false });
  }
  const adults = await activeFamilyUserIds(user.id);
  return NextResponse.json({ sharedPlan: adults.length > 1 });
}
