"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ShareModal, type ShareAnalyticsChannel } from "@/components/shared/ShareModal";
import { ArticleSaveHeart } from "@/features/save/ArticleSaveHeart";
import { postProductTelemetryEvent } from "@/lib/analytics/client";

type ArticleDetailActionsProps = {
  articleId: string;
  title: string;
  /** Relative path to this specific article (explicit, not window.location — continuous reading renders several articles at once). */
  href: string;
  coverImageUrl?: string | null;
  source?: string;
  citySlug?: string | null;
  className?: string;
};

export function ArticleDetailActions({
  articleId,
  title,
  href,
  coverImageUrl,
  source = "article-detail",
  citySlug,
  className,
}: ArticleDetailActionsProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}${href}` : href;

  const trackShare = (channel: ShareAnalyticsChannel) => {
    void postProductTelemetryEvent({
      eventType: "CTA_CLICK",
      entityType: "ARTICLE",
      entityId: articleId,
      vertical: "CITY",
      citySlug: citySlug ?? undefined,
      meta: {
        source: "detail",
        articleSource: source,
        section: "journal",
        targetAction: `article_share_${channel}`,
      },
    });
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ArticleSaveHeart
        articleId={articleId}
        articleTitle={title}
        coverImageUrl={coverImageUrl}
        variant="icon"
        className="h-11 w-11 border border-border bg-white shadow-none sm:h-10 sm:w-auto sm:px-4"
        iconClassName="h-5 w-5"
        source="detail"
        registerInHeader
      />
      <button
        type="button"
        onClick={() => setShareOpen(true)}
        aria-label="Поделиться статьёй"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-white text-foreground transition-colors hover:border-[rgba(20,18,16,0.28)] sm:h-10 sm:w-auto sm:gap-2 sm:px-4 sm:text-sm sm:font-medium"
      >
        <Share2 className="h-5 w-5 sm:h-4 sm:w-4" />
        <span className="hidden sm:inline">Поделиться</span>
      </button>
      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={shareUrl}
        title={title}
        entityNoun="статьёй"
        onShare={trackShare}
      />
    </div>
  );
}
