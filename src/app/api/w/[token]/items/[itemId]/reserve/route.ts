import { NextRequest, NextResponse } from "next/server";

import { reserveItem } from "@/server/wishlist/wishlistPublic.service";
import { setClaimCookie, withGuest } from "@/server/wishlist/wishlistPublicRoute";
import { guestReserveSchema } from "@/server/wishlist/wishlistPure";
import { readJson } from "@/server/wishlist/wishlistRoute";

type Ctx = { params: Promise<{ token: string; itemId: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const { token, itemId } = await params;
  return withGuest(
    request,
    token,
    async (viewer) => {
      const input = guestReserveSchema.parse(await readJson(request));
      const { reservationId, rawClaimToken } = await reserveItem(token, itemId, input, viewer);
      const res = NextResponse.json({ reservationId }, { status: 201 });
      setClaimCookie(res, token, [...viewer.rawClaims, rawClaimToken]);
      return res;
    },
    { bucket: "reserve", limit: 15, windowMs: 60 * 60_000 },
  );
}
