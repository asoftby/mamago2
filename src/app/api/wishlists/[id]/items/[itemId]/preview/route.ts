import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/security/rateLimit";
import { refreshItemPreview } from "@/server/wishlist/wishlist.service";
import { WishlistError } from "@/server/wishlist/wishlistPure";
import { withWishlistUser } from "@/server/wishlist/wishlistRoute";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

/** Pulls photo/title from the item's product link (author only). */
export async function POST(_request: Request, { params }: Ctx) {
  const { id, itemId } = await params;
  return withWishlistUser(async (user) => {
    const limit = await checkRateLimit(`wl:preview:${user.id}`, 30, 10 * 60_000);
    if (!limit.allowed) throw new WishlistError("rate_limited", "Слишком много запросов, попробуйте позже");
    return NextResponse.json(await refreshItemPreview(user.id, id, itemId));
  });
}
