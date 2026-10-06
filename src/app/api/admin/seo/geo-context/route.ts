import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import {
  SEO_GEO_CONTEXT_COOKIE,
  isSeoGeoContextToken,
} from "@/lib/admin/seo/geo";

export async function POST(req: NextRequest) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token =
    typeof body === "object" &&
    body !== null &&
    typeof (body as { token?: unknown }).token === "string"
      ? (body as { token: string }).token
      : null;

  if (!token || !isSeoGeoContextToken(token)) {
    return NextResponse.json(
      { error: "Expected body: { token: SeoGeoContextToken }" },
      { status: 400 },
    );
  }

  const res = NextResponse.json({ ok: true, token });
  res.cookies.set(SEO_GEO_CONTEXT_COOKIE, token, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 180,
  });
  return res;
}
