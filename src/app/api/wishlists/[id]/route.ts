import { NextRequest, NextResponse } from "next/server";

import { getWishlist, updateWishlist } from "@/server/wishlist/wishlist.service";
import { updateWishlistSchema } from "@/server/wishlist/wishlistPure";
import { readJson, withWishlistUser } from "@/server/wishlist/wishlistRoute";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withWishlistUser(async (user) => NextResponse.json({ wishlist: await getWishlist(user.id, id) }));
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withWishlistUser(async (user) => {
    const input = updateWishlistSchema.parse(await readJson(request));
    return NextResponse.json({ wishlist: await updateWishlist(user.id, id, input) });
  });
}
