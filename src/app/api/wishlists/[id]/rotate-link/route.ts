import { NextRequest, NextResponse } from "next/server";

import { rotateShareToken } from "@/server/wishlist/wishlist.service";
import { withWishlistUser } from "@/server/wishlist/wishlistRoute";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withWishlistUser(async (user) => NextResponse.json({ wishlist: await rotateShareToken(user.id, id) }));
}
