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
    <section className="border-b border-border" aria-label="Разделы журнала">
      <div className="site-wrap px-6 py-5 sm:px-7">
        <nav className="no-scrollbar flex items-center gap-3 overflow-x-auto py-1" aria-label="Разделы журнала">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/${citySlug}/blog/category/${category.slug}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-background py-1.5 pl-1.5 pr-4 text-sm font-semibold transition-colors hover:border-foreground/40 hover:bg-muted"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-base text-muted-foreground" aria-hidden="true">
                {category.thumbnailUrl ? (
                  <img src={category.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span>{category.name.slice(0, 1)}</span>
                )}
              </span>
              {category.name}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
