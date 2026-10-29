import { NextRequest, NextResponse } from "next/server";

import { reorderWishlistItems } from "@/server/wishlist/wishlist.service";
import { reorderItemsSchema } from "@/server/wishlist/wishlistPure";
import { readJson, withWishlistUser } from "@/server/wishlist/wishlistRoute";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withWishlistUser(async (user) => {
    const { itemIds } = reorderItemsSchema.parse(await readJson(request));
    return NextResponse.json({ wishlist: await reorderWishlistItems(user.id, id, itemIds) });
  });
}
