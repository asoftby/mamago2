import { releaseScopeApiGuard } from "@/server/release/releaseScopeApi";
import { NextResponse } from "next/server";
import { listDiscoveryClassChips } from "@/server/discovery/classChips";

export const runtime = "nodejs";

export async function GET() {
  const outOfScope = releaseScopeApiGuard("classes");
  if (outOfScope) return outOfScope;
  const chips = await listDiscoveryClassChips();
  return NextResponse.json(chips);
}
