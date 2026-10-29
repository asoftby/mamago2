import Link from "next/link";
import { notFound, redirect } from "next/navigation";

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
    <main className="mx-auto min-h-[70vh] w-full max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/me/wishlists" className="inline-flex min-h-11 items-center text-sm text-neutral-600 hover:text-neutral-900">
        ← Списки желаний
      </Link>
      <div className="mt-3">
        <WishlistEditor initial={wishlist} />
      </div>
    </main>
  );
}
