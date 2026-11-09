import Link from "next/link";
import { ArticleDynamicAfishaCards } from "@/components/article/blocks/ArticleDynamicAfishaCards";
import type { KudaListingItem } from "@/components/discovery/KudaMasonryListing";

/** Pure view: usable both in server-rendered articles and client-side continuous reader. */
export type ArticleDynamicAfishaData = {
  citySlug: string;
  href: string;
  filterSummary: string;
  items: KudaListingItem[];
};

export function ArticleDynamicAfishaBlock({
  data,
}: {
  data: ArticleDynamicAfishaData | null;
}) {
  if (!data) return null;
  return (
    <section className="not-prose my-8 space-y-4 font-sans" aria-label="Динамическая афиша">
      {data.items.length > 0 ? (
        <ArticleDynamicAfishaCards
          items={data.items}
          citySlug={data.citySlug}
          filterSummary={data.filterSummary}
        />
      ) : (
        <p className="rounded-xl bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
          Сейчас нет актуальных мероприятий по этой теме.
        </p>
      )}
      <Link
        href={data.href}
        className="inline-flex min-h-11 items-center rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground no-underline transition hover:bg-muted"
      >
        Все мероприятия и фильтры
      </Link>
    </section>
  );
}
