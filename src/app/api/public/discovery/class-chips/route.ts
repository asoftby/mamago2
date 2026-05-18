import { NextResponse } from "next/server";
import { listDiscoveryClassChips } from "@/server/discovery/classChips";

export const runtime = "nodejs";

export async function GET() {
  const chips = await listDiscoveryClassChips();
  return NextResponse.json(chips);
}
