"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type NextItem = { id: string; slug: string | null; title: string; excerpt: string | null };
type Page = { items: NextItem[]; nextCursor: string | null };

export function BreakingNewsLazyNext() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestedRef = useRef(false);
  const [items, setItems] = useState<NextItem[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);

  useEffect(() => {
    cursorRef.current = document.querySelector<HTMLElement>("[data-breaking-news-article-id]")?.dataset.breakingNewsArticleId ?? null;
  }, []);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || error) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || requestedRef.current || !cursorRef.current) return;
      requestedRef.current = true;
      setLoading(true);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      fetch(`/api/journal/breaking-news/next?cursor=${encodeURIComponent(cursorRef.current)}`, { signal: controller.signal })
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
        .catch(() => setError(true))
        .finally(() => {
          window.clearTimeout(timeout);
          requestedRef.current = false;
          setLoading(false);
        });
    }, { root: document.querySelector(".journal-news-panel"), rootMargin: "0px 0px 240px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, error, items.length]);

  if (!cursorRef.current && !items.length) return <div ref={sentinelRef} />;
  return (
    <section aria-label="Следующие Breaking News" className="mx-auto max-w-3xl px-5 pb-12 pt-8">
      <h2 className="mb-5 text-xl font-semibold">Далее в Breaking News</h2>
      <div className="grid gap-3">
        {items.map((item) => (
          <Link key={item.id} href={`/blog/${item.slug}`} className="rounded-xl border border-neutral-200 p-4 hover:bg-neutral-50">
            <strong className="block">{item.title}</strong>
            {item.excerpt && <span className="mt-1 block text-sm text-neutral-600">{item.excerpt}</span>}
          </Link>
        ))}
      </div>
      {loading && <p role="status" className="py-5 text-sm text-neutral-500">Загружаем следующие публикации…</p>}
      {error && <button type="button" onClick={() => setError(false)} className="py-5 text-sm underline">Повторить загрузку</button>}
      {hasMore && <div ref={sentinelRef} aria-hidden className="h-px" />}
    </section>
  );
}
