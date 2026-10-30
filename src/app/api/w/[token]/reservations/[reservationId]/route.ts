import { NextRequest, NextResponse } from "next/server";

import { updateOwnReservation } from "@/server/wishlist/wishlistPublic.service";
import { withGuest } from "@/server/wishlist/wishlistPublicRoute";
import { guestActionSchema } from "@/server/wishlist/wishlistPure";
import { readJson } from "@/server/wishlist/wishlistRoute";

type Ctx = { params: Promise<{ token: string; reservationId: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { token, reservationId } = await params;
  return withGuest(
    request,
    token,
    async (viewer) => {
      const { action } = guestActionSchema.parse(await readJson(request));
      await updateOwnReservation(token, reservationId, action, viewer);
      return NextResponse.json({ ok: true });
    },
    { bucket: "reservation", limit: 60, windowMs: 60 * 60_000 },
  );
}
