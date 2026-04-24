import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { resolveCompanyByUnp } from "@/server/company/resolveByUnp";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Требуется авторизация" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unp = (searchParams.get("unp") ?? "").replace(/\D/g, "").trim();

  if (!/^\d{9}$/.test(unp)) {
    return NextResponse.json({ ok: true, found: false, legalName: null, source: null });
  }

  const result = await resolveCompanyByUnp(unp);

  return NextResponse.json({
    ok: true,
    found: Boolean(result.legalName),
    legalName: result.legalName,
    source: result.source,
  });
}
