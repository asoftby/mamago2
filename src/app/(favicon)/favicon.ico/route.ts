import { NextRequest, NextResponse } from "next/server";

import { getBrandingConfig } from "@/lib/branding";
import { getBrandingFaviconHref } from "@/lib/brandingFavicon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const branding = await getBrandingConfig();
  const faviconHref = getBrandingFaviconHref(branding);

  if (!faviconHref) {
    return new NextResponse(null, {
      status: 404,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  const res = NextResponse.redirect(new URL(faviconHref, req.url));
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
