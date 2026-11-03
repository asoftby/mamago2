"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BreakingNewsView, type BreakingNewsViewProps } from "@/components/article/mvp/BreakingNewsView";
import { nextContinuationItem } from "@/lib/journal/breakingNewsContinuation";

type NextItem = { id: string; slug: string | null; title: string };
type Page = { items: NextItem[]; nextCursor: string | null };
type NewsPayload = Omit<BreakingNewsViewProps, "articleId" | "articleHref" | "citySlug" | "publishedAt"> & {
  id: string;
  slug: string;
  publishedAt: string | null;
};

type Props = {
  initialArticleId: string;
  initialArticleHref: string;
  citySlug?: string | null;
};

/**
 * Breaking News uses the same uninterrupted reading model as regular articles.
 * Only published, unexpired news are appended; the archive appears once the
 * complete continuation has been read (never between individual articles).
 */
export function BreakingNewsLazyNext({ initialArticleId, initialArticleHref, citySlug }: Props) {
  const [items, setItems] = useState<NextItem[]>([]);
  const [articles, setArticles] = useState<BreakingNewsViewProps[]>([]);
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [error, setError] = useState(false);

  const cursorRef = useRef<string>(initialArticleId);
  const listSentinelRef = useRef<HTMLDivElement>(null);
  const articleSentinelRef = useRef<HTMLDivElement>(null);
  const listRequestRef = useRef(false);
  const articleRequestRef = useRef(false);
  const listAbortRef = useRef<AbortController | null>(null);
  const articleAbortRef = useRef<AbortController | null>(null);
  const initialDocumentTitleRef = useRef<string | null>(null);

  const queryScope = citySlug ? "&city=" + encodeURIComponent(citySlug) : "";
  const articleBasePath = citySlug ? "/" + citySlug + "/blog/" : "/blog/";
  const archiveHref = (citySlug ? "/" + citySlug + "/blog" : "/blog") + "?type=news&archive=1";
  const loadedIds = new Set(articles.map((article) => article.articleId));
  const next = nextContinuationItem(items, loadedIds, new Set(unavailableIds));

  useEffect(() => {
    initialDocumentTitleRef.current = document.title;
    return () => {
      listAbortRef.current?.abort();
      articleAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (articles.length === 0) return;
    const root = document.querySelector<HTMLElement>(".journal-news-panel");
    const scrollTarget = root ?? window;
    const updateActiveArticle = () => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-breaking-news-article-id]"));
      const threshold = (root?.getBoundingClientRect().top ?? 0) + 120;
      const active = nodes.filter((node) => node.getBoundingClientRect().top <= threshold).at(-1) ?? nodes[0];
      const activeId = active?.dataset.breakingNewsArticleId;
      const article = articles.find((item) => item.articleId === activeId);
      const target = article?.articleHref ?? (activeId === initialArticleId ? initialArticleHref : null);
      if (target && window.location.pathname !== target) {
        window.history.replaceState(window.history.state, "", target);
      }
      const title = article ? article.title + " — mamaGo" : initialDocumentTitleRef.current;
      if (title && document.title !== title) document.title = title;
    };
    scrollTarget.addEventListener("scroll", updateActiveArticle, { passive: true });
    updateActiveArticle();
    return () => scrollTarget.removeEventListener("scroll", updateActiveArticle);
  }, [articles, initialArticleHref, initialArticleId]);

  // Fetch the next metadata page only after the current queue was read.
  useEffect(() => {
    const node = listSentinelRef.current;
    if (!node || !hasMore || error || next || listRequestRef.current) return;
    const root = document.querySelector<HTMLElement>(".journal-news-panel");
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || listRequestRef.current) return;
      observer.disconnect();
      listRequestRef.current = true;
      setLoadingList(true);
      const controller = new AbortController();
      listAbortRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      fetch("/api/journal/breaking-news/next?cursor=" + encodeURIComponent(cursorRef.current) + queryScope, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Cannot load the next Breaking News");
          return response.json() as Promise<Page>;
        })
        .then((page) => {
          if (controller.signal.aborted) return;
          setItems((previous) => {
            const seen = new Set(previous.map((item) => item.id));
            return [...previous, ...page.items.filter((item) => !seen.has(item.id))];
          });
          if (page.nextCursor) cursorRef.current = page.nextCursor;
          setHasMore(Boolean(page.nextCursor));
        })
        .catch(() => { if (!controller.signal.aborted) setError(true); })
        .finally(() => {
          window.clearTimeout(timeout);
          if (listAbortRef.current === controller) listAbortRef.current = null;
          listRequestRef.current = false;
          setLoadingList(false);
        });
    }, { root, rootMargin: "0px 0px 240px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [articles, error, hasMore, items, next, queryScope, unavailableIds]);

  // Fetch each full article only as its boundary approaches the viewport.
  useEffect(() => {
    const node = articleSentinelRef.current;
    if (!node || !next || error || articleRequestRef.current) return;
    const root = document.querySelector<HTMLElement>(".journal-news-panel");
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || articleRequestRef.current) return;
      observer.disconnect();
      articleRequestRef.current = true;
      setLoadingArticle(true);
      const controller = new AbortController();
      articleAbortRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      let unavailable = false;
      fetch("/api/journal/breaking-news/article?id=" + encodeURIComponent(next.id) + queryScope, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (response.status === 404) {
            unavailable = true;
            return null;
          }
          if (!response.ok) throw new Error("Cannot load the Breaking News article");
          return response.json() as Promise<{ article: NewsPayload }>;
        })
        .then((payload) => {
          if (!payload || controller.signal.aborted) return;
          const { article } = payload;
          setArticles((previous) => {
            if (previous.some((item) => item.articleId === article.id)) return previous;
            return [...previous, {
              ...article,
              articleId: article.id,
              publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
              citySlug,
              articleHref: articleBasePath + article.slug,
            }];
          });
        })
        .catch(() => { if (!controller.signal.aborted) setError(true); })
        .finally(() => {
          window.clearTimeout(timeout);
          if (articleAbortRef.current === controller) articleAbortRef.current = null;
          articleRequestRef.current = false;
          setLoadingArticle(false);
          if (unavailable && !controller.signal.aborted) {
            setUnavailableIds((previous) => previous.includes(next.id) ? previous : [...previous, next.id]);
          }
        });
    }, { root, rootMargin: "0px 0px 240px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [articleBasePath, articles, citySlug, error, next, queryScope]);

  const complete = !hasMore && !next && !loadingList && !loadingArticle && !error;
  return (
    <section aria-label="Продолжение Breaking News" className="bg-white pb-14">
      {articles.map((article) => (
        <section key={article.articleId} data-news-continuation={article.articleId} className="border-t border-border/60 pt-8">
          <BreakingNewsView {...article} />
        </section>
      ))}
      {loadingList || loadingArticle ? (
        <p role="status" className="mx-auto max-w-3xl px-4 py-6 text-center text-sm text-muted-foreground">
          Загружаем следующую публикацию…
        </p>
      ) : null}
      {error ? (
        <div className="mx-auto max-w-3xl px-4 py-6 text-center">
          <p className="mb-3 text-sm text-muted-foreground">Не удалось загрузить следующую публикацию.</p>
          <button type="button" className="text-sm text-primary underline underline-offset-2"
            onClick={() => { setError(false); listRequestRef.current = false; articleRequestRef.current = false; }}>
            Повторить загрузку
          </button>
        </div>
      ) : null}
      {next && !error ? <div ref={articleSentinelRef} className="h-px" aria-hidden /> : null}
      {hasMore && !next && !error ? <div ref={listSentinelRef} className="h-px" aria-hidden /> : null}
      {complete ? (
        <footer className="mx-auto max-w-3xl border-t border-border/60 px-4 pb-8 pt-8 text-center sm:px-6">
          <Link href={archiveHref} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
            Архив Breaking News
          </Link>
        </footer>
      ) : null}
    </section>
  );
}
