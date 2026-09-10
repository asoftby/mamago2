import Link from "next/link";
import { BlogPagination } from "@/app/(public)/blog/BlogPagination";
import { articleCategoryHubPath } from "@/lib/seo/articleCategoryHub";
import type {
  ArticleCategoryHubItem,
  PublicArticleCategory,
} from "@/server/article/articleCategoryHub";

export function ArticleCategoryNav({
  categories,
  citySlug,
  className = "",
}: {
  categories: PublicArticleCategory[];
  citySlug?: string | null;
  className?: string;
}) {
  if (categories.length === 0) return null;
  return (
    <nav
      aria-label="Разделы журнала"
      className={`site-wrap px-6 sm:px-7 ${className}`.trim()}
    >
      <div className="flex flex-wrap gap-2 border-b border-border py-4">
        <span className="mr-1 self-center text-[10px] font-mono uppercase tracking-[.14em] text-muted-foreground">
          Разделы
        </span>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={articleCategoryHubPath({ categorySlug: category.slug, citySlug })}
            className="rounded-full border border-border bg-background px-3.5 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          >
            {category.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function formatDate(value: Date | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

export function ArticleCategoryHubView({
  categoryName,
  description,
  articles,
  page,
  totalPages,
  citySlug,
}: {
  categoryName: string;
  description: string;
  articles: ArticleCategoryHubItem[];
  page: number;
  totalPages: number;
  citySlug?: string | null;
}) {
  const journalHref = citySlug ? `/${citySlug}/blog` : "/blog";
  const basePath = articleCategoryHubPath({
    categorySlug: articles.length >= 0 ? "placeholder" : "placeholder",
    citySlug,
  });
  void basePath;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 md:py-14">
      <nav aria-label="Хлебные крошки" className="mb-5 text-sm text-muted-foreground">
        <Link href={journalHref} className="hover:text-foreground hover:underline">
          Обзоры и статьи
        </Link>
        <span className="mx-2">/</span>
        <span>{categoryName}</span>
      </nav>

      <header className="mb-9 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl">
          {categoryName}
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground md:text-lg">
          {description}
        </p>
      </header>

      {articles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-sm text-muted-foreground">
          В этом разделе пока нет опубликованных материалов.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {articles.map((article) => (
            <article key={article.id} className="overflow-hidden rounded-2xl border border-border bg-background">
              <Link href={article.href} className="group block h-full">
                {article.coverImageUrl ? (
                  <img
                    src={article.coverImageUrl}
                    alt={article.title}
                    width={800}
                    height={500}
                    loading="lazy"
                    className="aspect-[8/5] w-full object-cover"
                  />
                ) : (
                  <div className="aspect-[8/5] w-full bg-muted" aria-hidden="true" />
                )}
                <div className="p-5">
                  {formatDate(article.publishedAt) ? (
                    <time className="text-xs text-muted-foreground">
                      {formatDate(article.publishedAt)}
                    </time>
                  ) : null}
                  <h2 className="mt-2 text-xl font-semibold leading-tight tracking-tight transition-colors group-hover:text-primary">
                    {article.title}
                  </h2>
                  {(article.subtitle || article.excerpt) ? (
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {article.subtitle || article.excerpt}
                    </p>
                  ) : null}
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}

      <BlogPagination
        basePath={articleCategoryHubPath({
          categorySlug: categoryName,
          citySlug,
        })}
        page={page}
        totalPages={totalPages}
      />
    </main>
  );
}
