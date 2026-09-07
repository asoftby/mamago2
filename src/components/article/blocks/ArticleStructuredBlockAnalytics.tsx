"use client";

import {
  useEffect,
  useRef,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";
import { postProductTelemetryEvent } from "@/lib/analytics/client";
import type { ArticleSubject } from "@/lib/publications/articleMvp";

export type ArticleStructuredBlockType = "contacts" | "price" | "openingHours";

export type ArticleStructuredAnalyticsContext = {
  articleId: string;
  citySlug?: string | null;
  blockId: string;
  blockType: ArticleStructuredBlockType;
  subject: ArticleSubject;
};

function analyticsMeta(
  context: ArticleStructuredAnalyticsContext,
  articleEvent: "article_subject_block_view" | "article_subject_action",
  extra?: Record<string, unknown>,
) {
  return {
    source: "detail" as const,
    section: "journal" as const,
    articleEvent,
    articleId: context.articleId,
    subjectId: context.subject.id,
    subjectTitle: context.subject.title,
    subjectSource: context.subject.source,
    catalogEntityType: context.subject.catalogEntityType,
    catalogEntityId: context.subject.catalogEntityId,
    blockId: context.blockId,
    blockType: context.blockType,
    ...extra,
  };
}

function currentArticleCitySlug(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && parts[1] === "blog" && parts[0] !== "blog") return parts[0];
  return undefined;
}

function telemetryBase(context: ArticleStructuredAnalyticsContext) {
  const citySlug = context.citySlug?.trim() || currentArticleCitySlug();
  return {
    vertical: "CITY" as const,
    citySlug,
  };
}

export function trackArticleStructuredAction(
  context: ArticleStructuredAnalyticsContext | undefined,
  action: string,
  actionItemId?: string,
) {
  if (!context) return;
  void postProductTelemetryEvent({
    eventType: "CTA_CLICK",
    ...telemetryBase(context),
    // Article-subject telemetry intentionally has no entityType/entityId.
    // The described object may not exist in the mamaGo catalog and these
    // inner-block actions must not be counted as publication CTA metrics.
    meta: analyticsMeta(context, "article_subject_action", {
      action,
      ...(actionItemId ? { actionItemId } : {}),
    }),
  });
}

export function ArticleStructuredBlockImpression({
  context,
  children,
}: {
  context?: ArticleStructuredAnalyticsContext;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (!context || fired.current || !ref.current || typeof IntersectionObserver === "undefined") return;
    let visibleTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5);
        if (!visible) {
          if (visibleTimer) clearTimeout(visibleTimer);
          visibleTimer = null;
          return;
        }
        if (visibleTimer || fired.current) return;
        visibleTimer = setTimeout(() => {
          if (fired.current) return;
          fired.current = true;
          void postProductTelemetryEvent({
            eventType: "CARD_VIEW",
            ...telemetryBase(context),
            // Same isolation rule as actions: the raw UserEvent is retained,
            // while canonical publication-view metrics exclude this scope.
            meta: analyticsMeta(context, "article_subject_block_view"),
          });
          observer.disconnect();
        }, 1000);
      },
      { threshold: [0.5] },
    );

    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      if (visibleTimer) clearTimeout(visibleTimer);
    };
  }, [context]);

  return <div ref={ref}>{children}</div>;
}

type TrackedAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  context?: ArticleStructuredAnalyticsContext;
  action: string;
  actionItemId?: string;
};

export function ArticleStructuredTrackedAnchor({
  context,
  action,
  actionItemId,
  onClick,
  children,
  ...props
}: TrackedAnchorProps) {
  return (
    <a
      {...props}
      onClick={(event) => {
        trackArticleStructuredAction(context, action, actionItemId);
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}
