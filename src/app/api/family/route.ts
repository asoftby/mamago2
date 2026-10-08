import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { listFamilyForUser, FamilyMembersError } from "@/server/family/familyMembers.service";

/** Profile → Family: adults, children and active invites of the user's family. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const family = await listFamilyForUser(prisma, user.id);
    return NextResponse.json({ family });
  } catch (error) {
    if (error instanceof FamilyMembersError && error.code === "disabled") {
      return NextResponse.json({ error: "disabled" }, { status: 404 });
    }
    console.error("[family] list failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
