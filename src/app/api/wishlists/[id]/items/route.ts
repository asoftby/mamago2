import { NextRequest, NextResponse } from "next/server";

import { addWishlistItem } from "@/server/wishlist/wishlist.service";
import { createItemSchema } from "@/server/wishlist/wishlistPure";
import { readJson, withWishlistUser } from "@/server/wishlist/wishlistRoute";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withWishlistUser(async (user) => {
    const input = createItemSchema.parse(await readJson(request));
    return NextResponse.json({ wishlist: await addWishlistItem(user.id, id, input) }, { status: 201 });
  });
}
