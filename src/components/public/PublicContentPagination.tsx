"use client";

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
  onPageChange: (page: number) => void;
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
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const items = getPageRange(page, totalPages);

  const goTo = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    onPageChange(nextPage);
  };

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
        <button
          type="button"
          aria-label="Предыдущая страница"
          disabled={page <= 1}
          onClick={() => goTo(page - 1)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {items.map((item, index) =>
          item === "…" ? (
            <span
              key={`ellipsis-${index}`}
              className="inline-flex h-10 min-w-8 items-center justify-center px-1 text-sm text-muted-foreground"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-current={item === page ? "page" : undefined}
              aria-label={`Страница ${item}`}
              onClick={() => goTo(item)}
              className={cn(
                "inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted",
                item === page &&
                  "border-primary bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          aria-label="Следующая страница"
          disabled={page >= totalPages}
          onClick={() => goTo(page + 1)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}
