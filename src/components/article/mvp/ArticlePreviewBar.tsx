"use client";

import Link from "next/link";
import type { ContentStatus } from "@prisma/client";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<ContentStatus, string> = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  PUBLISHED: "PUBLISHED",
  NEEDS_REVISION: "NEEDS_REVISION",
  REJECTED: "REJECTED",
  DELETED: "DELETED",
  PENDING_UPDATE: "PENDING_UPDATE",
  SCHEDULED: "SCHEDULED",
  ARCHIVED: "ARCHIVED",
};

type ArticlePreviewBarProps = {
  articleId: string;
  status: ContentStatus;
  /** Показать ссылку на /blog/[slug] только для опубликованной статьи со slug */
  publicSlug: string | null;
};

export function ArticlePreviewBar({ articleId, status, publicSlug }: ArticlePreviewBarProps) {
  const editHref = `/admin/content/articles/${articleId}/edit`;
  const slug = publicSlug?.trim();
  const blogHref =
    status === "PUBLISHED" && slug ? `/blog/${slug}` : null;

  return (
    <div
      className={cn(
        "sticky z-40 w-full border-b border-amber-300/60 bg-amber-50/95 backdrop-blur-sm",
        "supports-[backdrop-filter]:bg-amber-50/90",
        // Под приблизительную высоту site header (mobile fixed / desktop sticky)
        "top-14 lg:top-16",
      )}
      role="region"
      aria-label="Режим предпросмотра статьи"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-900/90">
            Предпросмотр статьи
          </span>
          <span
            className="inline-flex max-w-full items-center rounded-md border border-amber-200 bg-white/80 px-2 py-0.5 font-mono text-[11px] font-medium text-amber-950"
            title="Статус в системе"
          >
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          {blogHref ? (
            <Button variant="outline" size="sm" className="h-8 border-amber-300 bg-white/90 text-amber-950 hover:bg-amber-100" asChild>
              <Link href={blogHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 size-3.5" aria-hidden />
                Открыть публичную версию
              </Link>
            </Button>
          ) : null}
          <Button size="sm" className="h-8 bg-amber-800 text-white hover:bg-amber-900" asChild>
            <Link href={editHref}>Назад к редактированию</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
