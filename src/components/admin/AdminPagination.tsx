"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAdminPageRange, buildAdminPageHref } from "@/lib/admin/pagination";

export interface AdminPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  start: number;
  end: number;
  className?: string;
  /**
   * Server-rendered filter pages: pass the current route's `basePath` and
   * `params` (the awaited `searchParams` object, or a `URLSearchParams`) —
   * this component builds each page's href itself via `buildAdminPageHref`.
   * A function prop can't be used here: a Server Component can't pass a
   * function to this Client Component across the RSC boundary.
   */
  basePath?: string;
  params?: URLSearchParams | Record<string, string | string[] | undefined>;
  /**
   * Already-client-side pages (e.g. inside another "use client" component)
   * may pass a function directly instead of basePath/params.
   */
  hrefForPage?: (page: number) => string;
  /** Client-fetch pages: navigate via local page state instead of the URL. */
  onPageChange?: (page: number) => void;
}

interface PageControlProps {
  targetPage: number;
  disabled?: boolean;
  children: React.ReactNode;
  label: string;
  active?: boolean;
  numeric?: boolean;
  hrefForPage?: (page: number) => string;
  onPageChange?: (page: number) => void;
}

function PageControl({
  targetPage,
  disabled,
  children,
  label,
  active,
  numeric,
  hrefForPage,
  onPageChange,
}: PageControlProps) {
  const size = numeric ? "sm" : "icon-sm";
  const extraClassName = numeric ? "min-w-8 justify-center px-2" : undefined;

  if (disabled) {
    return (
      <Button
        variant="outline"
        size={size}
        className={extraClassName}
        disabled
        aria-label={label}
      >
        {children}
      </Button>
    );
  }

  if (hrefForPage) {
    return (
      <Button
        asChild
        variant={active ? "default" : "outline"}
        size={size}
        className={extraClassName}
        aria-label={label}
        aria-current={active ? "page" : undefined}
      >
        <Link href={hrefForPage(targetPage)} scroll={false}>
          {children}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant={active ? "default" : "outline"}
      size={size}
      className={extraClassName}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={() => onPageChange?.(targetPage)}
    >
      {children}
    </Button>
  );
}

/**
 * Unified Back/page-numbers/Forward control for `/admin/**` list pages.
 * Renders nothing when there's at most one page. Provide either
 * `hrefForPage` (Link-based, keeps `?page=` in the URL) or `onPageChange`
 * (client-state-based) — not both.
 */
export function AdminPagination({
  page,
  totalPages,
  total,
  start,
  end,
  className,
  basePath,
  params,
  hrefForPage,
  onPageChange,
}: AdminPaginationProps) {
  const resolvedHrefForPage =
    basePath !== undefined ? (p: number) => buildAdminPageHref(basePath, params ?? {}, p) : hrefForPage;

  const summary =
    total === 0 ? "Найдено 0 записей" : `Показано ${start}–${end} из ${total}`;

  if (totalPages <= 1) {
    return <p className="text-sm text-gray-500">{summary}</p>;
  }

  const pageItems = getAdminPageRange(page, totalPages);
  const canGoBack = page > 1;
  const canGoForward = page < totalPages;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-sm text-gray-500">{summary}</p>
      <nav
        className="flex flex-wrap items-center gap-1"
        aria-label="Постраничная навигация"
      >
        <PageControl
          targetPage={page - 1}
          disabled={!canGoBack}
          label="Назад"
          hrefForPage={resolvedHrefForPage}
          onPageChange={onPageChange}
        >
          <ChevronLeft className="h-4 w-4" />
        </PageControl>

        {pageItems.map((item, idx) =>
          item === "…" ? (
            <span
              key={`ellipsis-${idx}`}
              className="px-1.5 text-sm text-gray-400 select-none"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <PageControl
              key={item}
              targetPage={item}
              active={item === page}
              label={`Страница ${item}`}
              numeric
              hrefForPage={resolvedHrefForPage}
              onPageChange={onPageChange}
            >
              {item}
            </PageControl>
          ),
        )}

        <PageControl
          targetPage={page + 1}
          disabled={!canGoForward}
          label="Вперёд"
          hrefForPage={resolvedHrefForPage}
          onPageChange={onPageChange}
        >
          <ChevronRight className="h-4 w-4" />
        </PageControl>
      </nav>
    </div>
  );
}
