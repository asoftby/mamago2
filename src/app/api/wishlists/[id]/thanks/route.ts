import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/security/rateLimit";
import { assertWishlistAccess, sendWishlistThanks } from "@/server/wishlist/wishlist.service";
import { WishlistError, thanksSchema } from "@/server/wishlist/wishlistPure";
import { readJson, withWishlistUser } from "@/server/wishlist/wishlistRoute";

type Ctx = { params: Promise<{ id: string }> };
const DAY_MS = 24 * 60 * 60 * 1000;

/** POST /api/wishlists/[id]/thanks — thank everyone who holds a gift (1 per day per list). */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withWishlistUser(async (user) => {
    const { message } = thanksSchema.parse(await readJson(request));
    // Access first: a stranger must not be able to burn the owner's daily slot.
    await assertWishlistAccess(user.id, id);
    const limit = await checkRateLimit(`wl:thanks:${id}`, 1, DAY_MS);
    if (!limit.allowed) throw new WishlistError("rate_limited", "Спасибо уже отправлено сегодня");
    return NextResponse.json(await sendWishlistThanks(user.id, id, message));
  });
}
