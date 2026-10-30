import { NextRequest, NextResponse } from "next/server";

import { getPublicWishlist } from "@/server/wishlist/wishlistPublic.service";
import { withGuest } from "@/server/wishlist/wishlistPublicRoute";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const { token } = await params;
  return withGuest(
    request,
    token,
    async (viewer) => {
      const res = NextResponse.json({ wishlist: await getPublicWishlist(token, viewer) });
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    },
    { bucket: "view", limit: 120, windowMs: 60_000 },
  );
}
