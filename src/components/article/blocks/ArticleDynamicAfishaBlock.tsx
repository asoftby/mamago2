import Link from "next/link";
import { ArticleDynamicAfishaCards } from "@/components/article/blocks/ArticleDynamicAfishaCards";
import { getActivePublicOccasions } from "@/lib/discovery/occasions";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { loadKudaListingPage } from "@/server/discovery/kudaListingPage";

/**
 * Editorial placement of the real «Куда пойти» feed.
 * No independent scoring, manual event selection, Boost override or event cache:
 * the same server listing chooses cards, order and commercial exposures.
 */
export async function ArticleDynamicAfishaBlock({
  citySlug,
  occasionSlug,
}: {
  citySlug?: string | null;
  occasionSlug?: string | null;
}) {
  // A country-wide article has no unambiguous city selection. Never silently
  // substitute Minsk events for a national article.
  if (!citySlug) return null;

  const [city, occasions] = await Promise.all([
    findCityBySlug(citySlug),
    getActivePublicOccasions(),
  ]);
  if (!city) return null;

  const occasion = occasionSlug?.trim() || null;
  const activeSlugs = new Set(occasions.map((item) => item.slug));
  // The catalog ignores expired occasion filters. In an editorial placement that
  // would silently show unrelated events, so keep the block empty instead.
  const active = !occasion || activeSlugs.has(occasion);
  const filters = new URLSearchParams();
  if (occasion) filters.set("occasion", occasion);
  const listing = active
    ? await loadKudaListingPage({
        cityId: city.id,
        citySlug: city.slug,
        userId: null,
        searchParams: filters,
        page: 1,
        pageSize: 8,
        activeOccasionSlugs: activeSlugs,
      })
    : null;
  const href = `/${city.slug}/events${occasion && active ? `?occasion=${encodeURIComponent(occasion)}` : ""}`;

  return (
    <section className="not-prose my-8 space-y-4 font-sans" aria-label="Динамическая афиша">
      {listing?.items.length ? (
        <ArticleDynamicAfishaCards
          items={listing.items}
          citySlug={city.slug}
          filterSummary={occasion ? `occasion:${occasion}` : "all"}
        />
      ) : (
        <p className="rounded-xl bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
          Сейчас нет актуальных мероприятий по этой теме.
        </p>
      )}
      <Link
        href={href}
        className="inline-flex min-h-11 items-center rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground no-underline transition hover:bg-muted"
      >
        Все мероприятия и фильтры
      </Link>
    </section>
  );
}
