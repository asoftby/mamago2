import { NextRequest, NextResponse } from "next/server";

import { removeWishlistItem, updateWishlistItem } from "@/server/wishlist/wishlist.service";
import { updateItemSchema } from "@/server/wishlist/wishlistPure";
import { readJson, withWishlistUser } from "@/server/wishlist/wishlistRoute";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id, itemId } = await params;
  return withWishlistUser(async (user) => {
    const input = updateItemSchema.parse(await readJson(request));
    return NextResponse.json({ wishlist: await updateWishlistItem(user.id, id, itemId, input) });
  });
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id, itemId } = await params;
  return withWishlistUser(async (user) => {
    const confirmReserved = request.nextUrl.searchParams.get("confirmReserved") === "1";
    return NextResponse.json({ wishlist: await removeWishlistItem(user.id, id, itemId, { confirmReserved }) });
  });
}
