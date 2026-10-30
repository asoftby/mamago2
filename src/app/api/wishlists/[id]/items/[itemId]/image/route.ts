import { getOwnerItemImageUrl } from "@/server/wishlist/wishlist.service";
import { readStoredWishlistImage, wishlistImageResponse } from "@/server/wishlist/wishlistImage";
import { wishlistEnabled } from "@/server/wishlist/wishlistPure";
import { getCurrentUser } from "@/lib/auth/server";
import { WishlistError } from "@/server/wishlist/wishlistPure";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

/** Item photo we stored ourselves (link preview), served to the author / family only. */
export async function GET(_request: Request, { params }: Ctx) {
  if (!wishlistEnabled()) return wishlistImageResponse(null);
  const user = await getCurrentUser();
  if (!user) return wishlistImageResponse(null);
  const { id, itemId } = await params;
  try {
    return wishlistImageResponse(await readStoredWishlistImage(await getOwnerItemImageUrl(user.id, id, itemId)));
  } catch (error) {
    if (error instanceof WishlistError) return wishlistImageResponse(null);
    throw error;
  }
}
