import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/server";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { PublicWishlist } from "@/features/wishlist/components/PublicWishlist";
import { getPublicWishlist } from "@/server/wishlist/wishlistPublic.service";
import { WishlistError, claimCookieName, parseClaimCookie, wishlistEnabled } from "@/server/wishlist/wishlistPure";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

// Capability URL: never indexed, never leaks the token via Referer.
export async function generateMetadata() {
  const base = applyGlobalRobotsOverride({ title: "Список желаний" });
  return {
    ...base,
    robots: { index: false, follow: false },
    referrer: "no-referrer" as const,
  };
}

export default async function PublicWishlistPage({ params }: PageProps) {
  if (!wishlistEnabled()) notFound();
  const { token } = await params;
  const [user, jar] = await Promise.all([getCurrentUser(), cookies()]);
  const rawClaims = parseClaimCookie(jar.get(claimCookieName(token))?.value);

  let wishlist;
  try {
    wishlist = await getPublicWishlist(token, { userId: user?.id ?? null, rawClaims });
  } catch (error) {
    if (error instanceof WishlistError && error.code === "not_found") notFound();
    throw error;
  }

  // Deep links that let a guest get Telegram messages about their own reservations.
  const { wishlistTelegramUrl } = await import("@/server/wishlist/wishlistNotify");
  const telegramUrls: Record<string, string> = {};
  for (const item of wishlist.items) {
    for (const r of item.mine) {
      if (r.contact === "telegram") continue;
      const url = wishlistTelegramUrl(r.id);
      if (url) telegramUrls[r.id] = url;
    }
  }

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-3xl px-4 py-8 sm:px-6">
      <PublicWishlist token={token} wishlist={wishlist} telegramUrls={telegramUrls} />
      <p className="mt-10 text-center text-sm text-neutral-600">
        Тоже готовите праздник?{" "}
        <Link href="/me/wishlists" className="text-primary hover:underline">
          Создать свой список желаний
        </Link>
      </p>
    </main>
  );
}
