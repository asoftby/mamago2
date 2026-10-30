import { NextResponse } from "next/server";

import { cancelReservationAsOwner } from "@/server/wishlist/wishlist.service";
import { withWishlistUser } from "@/server/wishlist/wishlistRoute";

type Ctx = { params: Promise<{ id: string; reservationId: string }> };

/** Author releases a reservation. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const { id, reservationId } = await params;
  return withWishlistUser(async (user) =>
    NextResponse.json({ wishlist: await cancelReservationAsOwner(user.id, id, reservationId) }),
  );
}
