import { getPublicItemImageUrl } from "@/server/wishlist/wishlistPublic.service";
import { readStoredWishlistImage, wishlistImageResponse } from "@/server/wishlist/wishlistImage";
import { WishlistError, wishlistEnabled } from "@/server/wishlist/wishlistPure";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string; itemId: string }> };

/** Item photo we stored ourselves, served to anyone holding the share link (no account). */
export async function GET(_request: Request, { params }: Ctx) {
  if (!wishlistEnabled()) return wishlistImageResponse(null);
  const { token, itemId } = await params;
  try {
    return wishlistImageResponse(await readStoredWishlistImage(await getPublicItemImageUrl(token, itemId)));
  } catch (error) {
    if (error instanceof WishlistError) return wishlistImageResponse(null);
    throw error;
  }
}
