"use client";

import { BreakingNewsView, type BreakingNewsViewProps } from "@/components/article/mvp/BreakingNewsView";
import { useEffect, useRef, useState } from "react";

type NextItem = { id: string; slug: string | null; title: string; excerpt: string | null };
type Page = { items: NextItem[]; nextCursor: string | null };

export function BreakingNewsLazyNext() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const [items, setItems] = useState<NextItem[]>([]);
  const [articles, setArticles] = useState<Array<BreakingNewsViewProps>>([]);
  const fullRequestRef = useRef(false);
  const fullAbortRef = useRef<AbortController | null>(null);
  const fullSentinelRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const initialPathRef = useRef<string>("");
  const cityRef = useRef<string>("");

  useEffect(() => {
    cursorRef.current = document.querySelector<HTMLElement>("[data-breaking-news-article-id]")?.dataset.breakingNewsArticleId ?? null;
    initialPathRef.current = window.location.pathname.split("/").slice(0, -1).join("/");
    cityRef.current = window.location.pathname.split("/")[1] ?? "";
  }, []);

  useEffect(() => () => { abortRef.current?.abort(); fullAbortRef.current?.abort(); }, []);

  useEffect(() => {
    const node = fullSentinelRef.current;
    const next = items.find((item) => !articles.some((article) => article.articleId === item.id));
    if (!node || !next || fullRequestRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || fullRequestRef.current) return;
      fullRequestRef.current = true;
      const controller = new AbortController();
      fullAbortRef.current = controller;
      fetch(`/api/journal/breaking-news/article?id=${encodeURIComponent(next.id)}&city=${encodeURIComponent(cityRef.current)}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("Article unavailable");
          return response.json() as Promise<{ article: Omit<BreakingNewsViewProps, "articleId" | "related" | "articleHref" | "citySlug"> & { id: string; slug: string } }>;
        })
        .then(({ article }) => {
          if (controller.signal.aborted) return;
          setArticles((previous) => [...previous, { ...article, articleId: article.id, publishedAt: article.publishedAt ? new Date(article.publishedAt) : null, related: [], citySlug: cityRef.current, articleHref: `${initialPathRef.current}/${article.slug}` }].slice(-8));
        })
        .catch(() => { if (!controller.signal.aborted) setError(true); })
        .finally(() => { fullRequestRef.current = false; });
    }, { root: document.querySelector(".journal-news-panel"), rootMargin: "0px 0px 240px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [items, articles]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || error) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || requestedRef.current || !cursorRef.current) return;
      requestedRef.current = true;
      setLoading(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      fetch(`/api/journal/breaking-news/next?cursor=${encodeURIComponent(cursorRef.current)}&city=${encodeURIComponent(cityRef.current)}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("Failed to load next stories");
          return response.json() as Promise<Page>;
        })
        .then((page) => {
          setItems((previous) => {
            const seen = new Set(previous.map((item) => item.id));
            return [...previous, ...page.items.filter((item) => !seen.has(item.id))].slice(-12);
          });
          cursorRef.current = page.nextCursor;
          setHasMore(Boolean(page.nextCursor));
        })
.catch(() => { if (!controller.signal.aborted) setError(true); })
        .finally(() => {
          window.clearTimeout(timeout);
          if (abortRef.current === controller) abortRef.current = null;
          requestedRef.current = false;
          setLoading(false);
        });
    }, { root: document.querySelector(".journal-news-panel"), rootMargin: "0px 0px 240px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, error, items.length]);

  return (
    <section aria-label="Следующие Breaking News" className="mx-auto max-w-3xl px-5 pb-12 pt-8">
      <h2 className="mb-5 text-xl font-semibold">Далее в Breaking News</h2>
      {articles.map((article) => (
        <section key={article.articleId} data-news-continuation={article.articleId}>
          <BreakingNewsView {...article} />
        </section>
      ))}
      {!error && items.some((item) => !articles.some((article) => article.articleId === item.id)) && <div ref={fullSentinelRef} className="h-px" aria-hidden />}
      {loading && <p role="status" className="py-5 text-sm text-neutral-500">Загружаем следующие публикации…</p>}
      {error && <button type="button" onClick={() => setError(false)} className="py-5 text-sm underline">Повторить загрузку</button>}
      {hasMore && <div ref={sentinelRef} aria-hidden className="h-px" />}
    </section>
  );
}
