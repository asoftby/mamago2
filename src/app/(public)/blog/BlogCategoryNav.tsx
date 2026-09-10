import Link from "next/link";
import type { CityBlogCategory } from "@/server/article/cityBlogCategories";

export function BlogCategoryNav({
  citySlug,
  categories,
}: {
  citySlug: string;
  categories: CityBlogCategory[];
}) {
  if (categories.length === 0) return null;

  return (
    <section className="border-b border-border" aria-labelledby="journal-sections-title">
      <div className="site-wrap px-6 py-4 sm:px-7">
        <h2
          id="journal-sections-title"
          className="mb-2 text-[11px] font-mono uppercase tracking-[.14em] text-muted-foreground"
        >
          Разделы
        </h2>
        <nav className="no-scrollbar flex gap-2 overflow-x-auto py-1" aria-label="Разделы журнала">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/${citySlug}/blog/category/${category.slug}`}
              className="shrink-0 rounded-full border border-border bg-background px-4 py-2 text-sm transition-colors hover:border-foreground/40 hover:bg-muted"
            >
              {category.name}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
