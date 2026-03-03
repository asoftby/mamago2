import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyByUnp } from "@/server/company/resolveByUnp";

// Ensure Node.js runtime
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const unp = searchParams.get("unp");

  if (!unp) {
    return NextResponse.json(
      { error: "Missing unp parameter" },
      { status: 400 }
    );
  }

  console.log(`\n[DEV] Testing UNP lookup for: ${unp}`);
  console.log("=" .repeat(60));

  const result = await resolveCompanyByUnp(unp);

  console.log("=" .repeat(60));
  console.log(`[DEV] Result:`, result);
  console.log("\n");

  return NextResponse.json({
    unp,
    result,
    timestamp: new Date().toISOString(),
  });
}
