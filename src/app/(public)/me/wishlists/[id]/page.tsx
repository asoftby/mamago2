import { notFound, redirect } from "next/navigation";

import { AccountPage } from "@/components/account/AccountPage";
import { getCurrentUser } from "@/lib/auth/server";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { getWishlist } from "@/server/wishlist/wishlist.service";
import { WishlistError, wishlistEnabled } from "@/server/wishlist/wishlistPure";
import { WishlistEditor } from "@/features/wishlist/components/WishlistEditor";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata() {
  return applyGlobalRobotsOverride({ title: "Список желаний" });
}

export default async function WishlistEditorPage({ params }: PageProps) {
  if (!wishlistEnabled()) notFound();
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?redirectTo=/me/wishlists/${encodeURIComponent(id)}`);

  let wishlist;
  try {
    wishlist = await getWishlist(user.id, id);
  } catch (error) {
    if (error instanceof WishlistError && error.code === "not_found") notFound();
    throw error;
  }

  return (
    <AccountPage backHref="/me/wishlists" backLabel="← Списки желаний" title="Список желаний">
      <WishlistEditor initial={wishlist} />
    </AccountPage>
  );
}
