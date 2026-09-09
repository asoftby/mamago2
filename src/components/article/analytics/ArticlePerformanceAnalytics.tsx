"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  ARTICLE_PERFORMANCE_BATCH_MAX_EVENTS,
  type ArticlePerformanceAction,
  type ArticlePerformanceBatchEvent,
  type ArticlePerformanceBlockDescriptor,
} from "@/lib/article/articlePerformanceAnalytics";

type ArticlePerformanceQueue = {
  enqueueImpressions: (blocks: ArticlePerformanceBlockDescriptor[]) => void;
  enqueueAction: (
    block: ArticlePerformanceBlockDescriptor,
    action: ArticlePerformanceAction,
    actionItemId?: string,
  ) => void;
};

const AnalyticsContext = createContext<ArticlePerformanceQueue | null>(null);
const FLUSH_DELAY_MS = 30_000;
const SOFT_FLUSH_EVENTS = 60;

function storageKey(articleId: string, suffix: string) {
  return `mamago:article-performance:${articleId}:${suffix}`;
}

function getOrCreateSessionId(articleId: string): string {
  if (typeof window === "undefined") return "server";
  const key = storageKey(articleId, "session");
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(key, id);
    return id;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function readSeenImpressions(articleId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(storageKey(articleId, "seen"));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function persistSeenImpressions(articleId: string, seen: Set<string>) {
  try {
    window.sessionStorage.setItem(storageKey(articleId, "seen"), JSON.stringify([...seen].slice(-200)));
  } catch {
    // Analytics storage is best-effort and must never affect article UX.
  }
}

export function ArticlePerformanceProvider({
  articleId,
  children,
}: {
  articleId?: string;
  children: ReactNode;
}) {
  const queueRef = useRef<ArticlePerformanceBatchEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef<string>("");
  const seenRef = useRef<Set<string>>(new Set());

  const endpoint = articleId
    ? `/api/articles/${encodeURIComponent(articleId)}/analytics/batch`
    : null;

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const flush = useCallback((preferBeacon = false) => {
    if (!endpoint || queueRef.current.length === 0) return;
    clearTimer();
    const events = queueRef.current.splice(0, ARTICLE_PERFORMANCE_BATCH_MAX_EVENTS);
    const body = JSON.stringify({ sessionId: sessionIdRef.current, events });

    if (preferBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const accepted = navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
      if (accepted) return;
    }

    void fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
      credentials: "omit",
    }).catch(() => {
      // Telemetry is never on the critical path and intentionally has no retry storm.
    });
  }, [clearTimer, endpoint]);

  const scheduleFlush = useCallback(() => {
    if (!endpoint || timerRef.current) return;
    timerRef.current = setTimeout(() => flush(false), FLUSH_DELAY_MS);
  }, [endpoint, flush]);

  useEffect(() => {
    if (!articleId) return;
    sessionIdRef.current = getOrCreateSessionId(articleId);
    seenRef.current = readSeenImpressions(articleId);

    const onPageHide = () => flush(true);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flush(true);
      clearTimer();
    };
  }, [articleId, clearTimer, flush]);

  const value = useMemo<ArticlePerformanceQueue | null>(() => {
    if (!articleId || !endpoint) return null;

    const queue = (event: ArticlePerformanceBatchEvent) => {
      queueRef.current.push(event);
      if (queueRef.current.length >= SOFT_FLUSH_EVENTS) flush(false);
      else scheduleFlush();
    };

    return {
      enqueueImpressions(blocks) {
        let changed = false;
        for (const block of blocks) {
          const key = `${block.blockType}:${block.blockId}`;
          if (seenRef.current.has(key)) continue;
          seenRef.current.add(key);
          changed = true;
          queue({ ...block, kind: "impression" });
        }
        if (changed) persistSeenImpressions(articleId, seenRef.current);
      },
      enqueueAction(block, action, actionItemId) {
        queue({
          ...block,
          kind: "action",
          action,
          ...(actionItemId ? { actionItemId } : {}),
        });
      },
    };
  }, [articleId, endpoint, flush, scheduleFlush]);

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

function socialItemId(href: string): string | undefined {
  try {
    const host = new URL(href).hostname.toLowerCase().replace(/^www\./, "");
    if (host.includes("instagram")) return "instagram";
    if (host === "t.me" || host.includes("telegram")) return "telegram";
    if (host.includes("vk.com")) return "vk";
    if (host.includes("tiktok")) return "tiktok";
    if (host.includes("youtube") || host === "youtu.be") return "youtube";
  } catch {
    return undefined;
  }
  return undefined;
}

function actionFromAnchor(
  anchor: HTMLAnchorElement,
  root: HTMLElement,
  mode: "info" | "card",
): { action: ArticlePerformanceAction; item?: string } | null {
  if (mode === "card") return { action: "card_open" };
  const href = anchor.getAttribute("href") ?? "";
  if (href.startsWith("tel:")) {
    const phoneAnchors = [...root.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]')];
    const index = phoneAnchors.indexOf(anchor);
    return { action: "phone", item: index >= 0 ? `phone_${index + 1}` : undefined };
  }
  if (href.startsWith("mailto:")) return { action: "email" };
  if (/google\.[^/]+\/maps|maps\.google|maps\.apple/i.test(href)) return { action: "route" };
  const social = socialItemId(href);
  if (social) return { action: "social", item: social };
  if (/^https?:\/\//i.test(href)) return { action: "website" };
  return null;
}

/**
 * One observer/click listener per visible compact card. Impressions for all
 * constituent blocks are queued in memory and flushed together by the provider.
 */
export function ArticlePerformanceScope({
  blocks,
  mode,
  children,
}: {
  blocks: ArticlePerformanceBlockDescriptor[];
  mode: "info" | "card";
  children: ReactNode;
}) {
  const analytics = useContext(AnalyticsContext);
  const rootRef = useRef<HTMLDivElement>(null);
  const observedRef = useRef(false);

  useEffect(() => {
    if (!analytics || blocks.length === 0 || !rootRef.current || observedRef.current) return;
    if (typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5);
        if (!visible) {
          if (timer) clearTimeout(timer);
          timer = null;
          return;
        }
        if (timer) return;
        timer = setTimeout(() => {
          observedRef.current = true;
          analytics.enqueueImpressions(blocks);
          observer.disconnect();
        }, 1000);
      },
      { threshold: [0.5] },
    );
    observer.observe(rootRef.current);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [analytics, blocks]);

  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!analytics || blocks.length === 0 || !rootRef.current) return;
    const target = event.target as HTMLElement;
    const explicit = target.closest<HTMLElement>("[data-article-analytics-action]");
    const actionBlock = mode === "card"
      ? blocks[0]
      : blocks.find((block) => block.blockType === "contacts") ?? blocks[0];
    if (!actionBlock) return;

    if (explicit) {
      const action = explicit.dataset.articleAnalyticsAction as ArticlePerformanceAction | undefined;
      if (action) analytics.enqueueAction(actionBlock, action, explicit.dataset.articleAnalyticsItem);
      return;
    }

    const anchor = target.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || !rootRef.current.contains(anchor)) return;
    const resolved = actionFromAnchor(anchor, rootRef.current, mode);
    if (resolved) analytics.enqueueAction(actionBlock, resolved.action, resolved.item);
  };

  return (
    <div ref={rootRef} onClickCapture={onClickCapture}>
      {children}
    </div>
  );
}
