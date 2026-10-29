import { NextResponse } from "next/server";

import { copyWishlist } from "@/server/wishlist/wishlist.service";
import { withWishlistUser } from "@/server/wishlist/wishlistRoute";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/wishlists/[id]/copy — same list for next year (new link, no reservations). */
export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return withWishlistUser(async (user) => {
    return NextResponse.json({ wishlist: await copyWishlist(user.id, id) }, { status: 201 });
  });
}
