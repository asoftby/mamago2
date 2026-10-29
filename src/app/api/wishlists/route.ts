import { NextRequest, NextResponse } from "next/server";

import { createWishlist, listWishlists } from "@/server/wishlist/wishlist.service";
import { createWishlistSchema } from "@/server/wishlist/wishlistPure";
import { readJson, withWishlistUser } from "@/server/wishlist/wishlistRoute";

export async function GET(request: NextRequest) {
  return withWishlistUser(async (user) => {
    const params = request.nextUrl.searchParams;
    const wishlists = await listWishlists(user.id, {
      includeArchived: params.get("archived") === "1",
      recipientChildId: params.get("childId") ?? undefined,
    });
    return NextResponse.json({ wishlists });
  });
}

export async function POST(request: NextRequest) {
  return withWishlistUser(async (user) => {
    const input = createWishlistSchema.parse(await readJson(request));
    const wishlist = await createWishlist(user.id, input);
    return NextResponse.json({ wishlist }, { status: 201 });
  });
}
