"use client";

import { useEffect, useRef } from "react";
import { getPublicTelegramHref } from "@/lib/site/publicSocialLinks";
import { postProductTelemetryEvent } from "@/lib/analytics/client";
import { cn } from "@/lib/utils";

export type ArticleTelegramInvitationAnalytics = {
  articleId: string;
  articleSlug: string;
  sectionId?: string | null;
  sectionSlug?: string | null;
  cityId?: string | null;
  citySlug?: string | null;
  sessionPosition: number;
};

function TelegramGlyph({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M21 5L2 12.5l7 1 1 7 3-3 5.5 4L21 5Z"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArticleTelegramInvitation({
  analytics,
  className,
}: {
  analytics: ArticleTelegramInvitationAnalytics;
  className?: string;
}) {
  const href = getPublicTelegramHref();
  const impressedRef = useRef(false);
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || impressedRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.35);
        if (!hit || impressedRef.current) return;
        impressedRef.current = true;
        void postProductTelemetryEvent({
          eventType: "CARD_VIEW",
          entityType: "ARTICLE",
          entityId: analytics.articleId,
          vertical: "CITY",
          cityId: analytics.cityId ?? undefined,
          citySlug: analytics.citySlug ?? undefined,
          meta: {
            source: "detail",
            section: "journal",
            articleEvent: "article_telegram_cta_impression",
            articleSlug: analytics.articleSlug,
            sectionId: analytics.sectionId ?? null,
            sectionSlug: analytics.sectionSlug ?? null,
            position: analytics.sessionPosition,
            destinationUrl: href,
          },
        });
        observer.disconnect();
      },
      { threshold: [0, 0.35, 0.5] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [analytics, href]);

  const onClick = () => {
    void postProductTelemetryEvent({
      eventType: "CTA_CLICK",
      entityType: "ARTICLE",
      entityId: analytics.articleId,
      vertical: "CITY",
      cityId: analytics.cityId ?? undefined,
      citySlug: analytics.citySlug ?? undefined,
      meta: {
        source: "detail",
        section: "journal",
        articleEvent: "article_telegram_cta_click",
        articleSlug: analytics.articleSlug,
        sectionId: analytics.sectionId ?? null,
        sectionSlug: analytics.sectionSlug ?? null,
        position: analytics.sessionPosition,
        destinationUrl: href,
      },
    });
  };

  return (
    <section
      ref={rootRef}
      aria-label="Приглашение в Telegram-канал mamaGo"
      className={cn(
        "rounded-2xl border border-[#B7E0F5] bg-[#EFF8FD] px-5 py-5 sm:px-8 sm:py-7",
        className,
      )}
    >
      <div className="flex flex-col items-start gap-4">
        <h2 className="font-serif text-xl sm:text-2xl leading-snug tracking-tight text-foreground">
          Ещё больше идей для фамилинга — в Telegram
        </h2>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
          aria-label="Подписаться на mamaGo в Telegram"
          className={cn(
            "inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-full",
            "bg-[#26A5E4] px-6 text-[15px] font-semibold text-white",
            "transition-opacity hover:opacity-90 active:opacity-95",
            "motion-reduce:transition-none",
          )}
        >
          <TelegramGlyph className="h-4 w-4" />
          Подписаться на mamaGo
        </a>
      </div>
    </section>
  );
}
