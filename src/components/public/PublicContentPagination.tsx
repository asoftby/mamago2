"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type PageItem = number | "…";

function getPageRange(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (page <= 4) return [1, 2, 3, 4, 5, "…", totalPages];
  if (page >= totalPages - 3) {
    return [1, "…", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "…", page - 1, page, page + 1, "…", totalPages];
}

export interface PublicContentPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

export function PublicContentPagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  className,
}: PublicContentPaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const items = getPageRange(page, totalPages);

  const hrefForPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const handlePageClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    nextPage: number,
  ) => {
    if (!onPageChange || nextPage === page) return;
    event.preventDefault();
    onPageChange(nextPage);
  };

  const navLinkClass =
    "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background transition-colors hover:bg-muted";

  return (
    <div
      className={cn(
        "mt-8 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">
        {start}–{end} из {total}
      </p>

      <nav className="flex flex-wrap items-center gap-1.5" aria-label="Страницы материалов">
        {page > 1 ? (
          <Link
            href={hrefForPage(page - 1)}
            aria-label="Предыдущая страница"
            rel="prev"
            onClick={(event) => handlePageClick(event, page - 1)}
            className={navLinkClass}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span
            aria-hidden="true"
            className={cn(navLinkClass, "cursor-not-allowed opacity-35")}
          >
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}

        {items.map((item, index) =>
          item === "…" ? (
            <span
              key={`ellipsis-${index}`}
              className="inline-flex h-10 min-w-8 items-center justify-center px-1 text-sm text-muted-foreground"
              aria-hidden="true"
            >
              …
            </span>
          ) : item === page ? (
            <span
              key={item}
              aria-current="page"
              aria-label={`Страница ${item}`}
              className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-primary bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              {item}
            </span>
          ) : (
            <Link
              key={item}
              href={hrefForPage(item)}
              aria-label={`Страница ${item}`}
              onClick={(event) => handlePageClick(event, item)}
              className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              {item}
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Link
            href={hrefForPage(page + 1)}
            aria-label="Следующая страница"
            rel="next"
            onClick={(event) => handlePageClick(event, page + 1)}
            className={navLinkClass}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span
            aria-hidden="true"
            className={cn(navLinkClass, "cursor-not-allowed opacity-35")}
          >
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </nav>
    </div>
  );
}
