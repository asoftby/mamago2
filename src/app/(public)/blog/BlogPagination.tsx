import Link from "next/link";

function pageHref(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}?page=${page}`;
}

export function BlogPagination({
  basePath,
  page,
  totalPages,
}: {
  basePath: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);

  return (
    <nav
      aria-label="Страницы журнала"
      className="site-wrap flex flex-wrap items-center justify-center gap-2 px-6 pb-16 sm:px-7"
    >
      {page > 1 ? (
        <Link
          href={pageHref(basePath, page - 1)}
          rel="prev"
          className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-foreground/40"
        >
          ← Назад
        </Link>
      ) : null}

      {start > 1 ? (
        <>
          <Link
            href={pageHref(basePath, 1)}
            className="rounded-full border border-border px-3.5 py-2 text-sm hover:border-foreground/40"
          >
            1
          </Link>
          {start > 2 ? <span className="px-1 text-sm text-muted-foreground">…</span> : null}
        </>
      ) : null}

      {pages.map((item) => (
        <Link
          key={item}
          href={pageHref(basePath, item)}
          aria-current={item === page ? "page" : undefined}
          className={
            item === page
              ? "rounded-full bg-foreground px-3.5 py-2 text-sm font-semibold text-background"
              : "rounded-full border border-border px-3.5 py-2 text-sm hover:border-foreground/40"
          }
        >
          {item}
        </Link>
      ))}

      {end < totalPages ? (
        <>
          {end < totalPages - 1 ? <span className="px-1 text-sm text-muted-foreground">…</span> : null}
          <Link
            href={pageHref(basePath, totalPages)}
            className="rounded-full border border-border px-3.5 py-2 text-sm hover:border-foreground/40"
          >
            {totalPages}
          </Link>
        </>
      ) : null}

      {page < totalPages ? (
        <Link
          href={pageHref(basePath, page + 1)}
          rel="next"
          className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-foreground/40"
        >
          Вперёд →
        </Link>
      ) : null}
    </nav>
  );
}
