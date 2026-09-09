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
        source,
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
        variant="labeled"
        source={source}
      />
      <button
        type="button"
        onClick={() => setShareOpen(true)}
        aria-label="Поделиться статьёй"
        className="inline-flex h-10 items-center gap-2 rounded-full border border-[rgba(20,18,16,0.14)] bg-white px-4 text-sm font-medium text-foreground transition-colors hover:border-[rgba(20,18,16,0.28)]"
      >
        <Share2 className="h-4 w-4" />
        <span>Поделиться</span>
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
