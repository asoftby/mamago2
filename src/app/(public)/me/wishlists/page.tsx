import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AccountPage } from "@/components/account/AccountPage";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { childScopeFor } from "@/server/family/familyAccess";
import { listWishlists } from "@/server/wishlist/wishlist.service";
import { wishlistEnabled } from "@/server/wishlist/wishlistPure";
import { CreateWishlistForm } from "@/features/wishlist/components/CreateWishlistForm";
import { formatEventDate } from "@/features/wishlist/lib/wishlistView";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return applyGlobalRobotsOverride({ title: "Списки желаний" });
}

type PageProps = { searchParams: Promise<{ childId?: string; title?: string; date?: string }> };

export default async function WishlistsPage({ searchParams }: PageProps) {
  if (!wishlistEnabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirectTo=/me/wishlists");
  const { childId, title, date } = await searchParams;
  // Prefill from the birthday-party screen; anything malformed is simply ignored.
  const defaultDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
  const defaultTitle = title ? title.trim().slice(0, 120) : "";

  const [wishlists, children] = await Promise.all([
    listWishlists(user.id, { includeArchived: true }),
    prisma.child.findMany({
      where: await childScopeFor(user.id),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  const active = wishlists.filter((w) => w.status === "ACTIVE");
  const archived = wishlists.filter((w) => w.status === "ARCHIVED");

  return (
    <AccountPage
      backHref="/me/profile"
      backLabel="← Моя семья"
      title="Списки желаний"
      lead="Составьте список подарков и поделитесь ссылкой: гости отметят, что берут, без регистрации."
    >
      {active.length > 0 ? (
        <ul className="mb-6 space-y-2">
          {active.map((w) => (
            <li key={w.id}>
              <WishlistRow w={w} />
            </li>
          ))}
        </ul>
      ) : null}

      <CreateWishlistForm childrenList={children} defaultChildId={childId ?? null} defaultTitle={defaultTitle} defaultDate={defaultDate} />

      {archived.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-medium text-neutral-500">Архив</h2>
          <ul className="space-y-2">
            {archived.map((w) => (
              <li key={w.id}>
                <WishlistRow w={w} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AccountPage>
  );
}

function WishlistRow({
  w,
}: {
  w: { id: string; title: string; eventDate: string | null; recipientLabel: string | null; itemCount: number; takenCount: number };
}) {
  const meta = [w.recipientLabel, formatEventDate(w.eventDate), `Подарков: ${w.itemCount}`, w.takenCount ? `занято: ${w.takenCount}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      href={`/me/wishlists/${w.id}`}
      className="block rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-sm hover:border-neutral-300"
    >
      <span className="block font-medium text-neutral-950">{w.title}</span>
      <span className="mt-0.5 block text-sm text-neutral-600">{meta}</span>
    </Link>
  );
}
