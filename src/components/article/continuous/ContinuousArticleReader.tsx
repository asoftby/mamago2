"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { GeoScope } from "@prisma/client";
import { ArticleMvpView } from "@/components/article/mvp/ArticleMvpView";
import { ArticleSectionExhausted } from "@/components/article/continuous/ArticleContinuationDivider";
import { ArticleIntermission } from "@/components/article/continuous/ArticleIntermission";
import type {
  NextArticlePreviewDto,
  PublicContinuousArticleDto,
} from "@/lib/article/nextArticleInSection";
import {
  createContinuousReaderState,
  excludeIdsFromState,
  pickActiveArticleIndex,
  progressBucketsCrossed,
  reduceContinuousReader,
  type ContinuousReaderState,
} from "@/lib/article/continuousReadingState";
import { createContinuousAnalyticsTracker } from "@/lib/article/continuousReadingAnalytics";

type ContinuousSeed = Omit<PublicContinuousArticleDto, "blocks">;

type Props = {
  seed: ContinuousSeed;
  citySlug: string | null;
  cityId: string | null;
  geoScope: GeoScope;
  section: { id: string; slug: string; name: string };
  /** SSR preview следующей статьи (legacy prop; разделитель убран — непрерывный скролл без карточки «далее»). */
  initialNextPreview: NextArticlePreviewDto | null;
  initialExhausted?: boolean;
  /** SSR HTML первой статьи. */
  firstArticleSlot: ReactNode;
};

const ACTIVE_STABLE_MS = 180;
const PREFETCH_ROOT_MARGIN = "0px 0px 35% 0px";
const VIEW_RATIO = 0.45;
const VIEW_DWELL_MS = 1200;

function articleToRef(
  a: Pick<ContinuousSeed, "id" | "slug" | "href" | "documentTitle">,
) {
  return {
    id: a.id,
    slug: a.slug,
    href: a.href,
    documentTitle: a.documentTitle,
  };
}

export function ContinuousArticleReader({
  seed,
  citySlug,
  cityId,
  geoScope,
  section,
  initialNextPreview: _initialNextPreview,
  initialExhausted = false,
  firstArticleSlot,
}: Props) {
  const [state, setState] = useState<ContinuousReaderState>(() => {
    const base = createContinuousReaderState(articleToRef(seed));
    if (initialExhausted) {
      return {
        ...base,
        loadStatus: "exhausted",
        exhaustedAnnounced: true,
      };
    }
    return base;
  });
  const [loaded, setLoaded] = useState<PublicContinuousArticleDto[]>([]);
  const [liveMessage, setLiveMessage] = useState("");

  const stateRef = useRef(state);
  const abortRef = useRef<AbortController | null>(null);
  const prefetchSentinelRef = useRef<HTMLDivElement | null>(null);
  const articleElsRef = useRef<Map<number, HTMLElement>>(new Map());
  const activeCandidateRef = useRef(0);
  const activeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressPrevRef = useRef<Map<string, number>>(new Map());
  const viewTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const analyticsRef = useRef(createContinuousAnalyticsTracker());
  const prefetchLockRef = useRef(false);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const journalHref = citySlug?.trim() ? `/${citySlug.trim()}/blog` : "/blog";

  const dispatch = useCallback(
    (event: Parameters<typeof reduceContinuousReader>[1]) => {
      setState((prev) => {
        const next = reduceContinuousReader(prev, event);
        stateRef.current = next;
        return next;
      });
    },
    [],
  );

  const analyticsCtx = useCallback(
    (articleId: string, position: number, previousArticleId: string | null) => ({
      cityId,
      citySlug,
      sectionId: section.id,
      sectionSlug: section.slug,
      sourceArticleId: seed.id,
      sessionPosition: position,
      previousArticleId,
    }),
    [cityId, citySlug, section.id, section.slug, seed.id],
  );

  const fetchNext = useCallback(async () => {
    const prev = stateRef.current;
    if (
      prefetchLockRef.current ||
      prev.loadStatus === "loading" ||
      prev.loadStatus === "exhausted"
    ) {
      return;
    }
    // Уже есть одна следующая в DOM — не грузим дальше, пока пользователь до неё не дойдёт
    if (prev.articles.length > prev.activeIndex + 1) return;

    const withLoading = reduceContinuousReader(prev, { type: "PREFETCH_NEAR_END" });
    if (withLoading.requestGeneration === prev.requestGeneration) return;

    prefetchLockRef.current = true;
    stateRef.current = withLoading;
    setState(withLoading);

    const generation = withLoading.requestGeneration;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLiveMessage("Загружаем следующую статью");

    try {
      const res = await fetch("/api/public/articles/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: ac.signal,
        body: JSON.stringify({
          currentArticleId: seed.id,
          sectionId: section.id,
          cityId,
          geoScope,
          excludeIds: excludeIdsFromState(withLoading),
        }),
      });

      if (!res.ok) throw new Error(`http_${res.status}`);
      const data = (await res.json()) as {
        article: PublicContinuousArticleDto | null;
        exhausted: boolean;
      };

      if (ac.signal.aborted) return;

      if (!data.article || data.exhausted) {
        dispatch({ type: "LOAD_EMPTY", generation });
        setLiveMessage("Вы прочитали все материалы этого раздела");
        analyticsRef.current.track(
          "article_section_exhausted",
          seed.id,
          seed.slug,
          analyticsCtx(seed.id, stateRef.current.articles.length, null),
          { sectionName: section.name },
        );
        return;
      }

      setLoaded((list) => {
        if (list.some((a) => a.id === data.article!.id)) return list;
        return [...list, data.article!];
      });
      dispatch({
        type: "LOAD_SUCCESS",
        generation,
        article: articleToRef(data.article),
      });
      setLiveMessage(`Начало статьи: ${data.article.title}`);
      analyticsRef.current.track(
        "next_article_loaded",
        data.article.id,
        data.article.slug,
        analyticsCtx(
          data.article.id,
          stateRef.current.articles.length,
          stateRef.current.articles.at(-1)?.id ?? seed.id,
        ),
      );
    } catch (e) {
      if (ac.signal.aborted) return;
      dispatch({
        type: "LOAD_ERROR",
        generation,
        message: e instanceof Error ? e.message : "load_failed",
      });
      setLiveMessage("Не удалось загрузить следующую статью");
    } finally {
      prefetchLockRef.current = false;
    }
  }, [
    analyticsCtx,
    cityId,
    dispatch,
    geoScope,
    section.id,
    section.name,
    seed.id,
    seed.slug,
  ]);

  useEffect(() => {
    const el = prefetchSentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (state.loadStatus === "exhausted") return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        void fetchNext();
      },
      { root: null, rootMargin: PREFETCH_ROOT_MARGIN, threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [fetchNext, state.articles.length, state.loadStatus, state.activeIndex]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const headerTop = (index: number): number => {
      const root = articleElsRef.current.get(index);
      if (!root) return Number.POSITIVE_INFINITY;
      const h1 = root.querySelector("h1");
      return (h1 ?? root).getBoundingClientRect().top;
    };

    const measure = () => {
      const count = stateRef.current.articles.length;
      const tops: number[] = [];
      for (let i = 0; i < count; i++) tops.push(headerTop(i));
      const candidate = pickActiveArticleIndex({
        headerTops: tops,
        viewportHeight: window.innerHeight,
      });
      if (candidate === activeCandidateRef.current) return;
      activeCandidateRef.current = candidate;
      if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
      activeTimerRef.current = setTimeout(() => {
        const idx = activeCandidateRef.current;
        if (idx === stateRef.current.activeIndex) return;
        dispatch({ type: "SET_ACTIVE_INDEX", index: idx, stableMs: ACTIVE_STABLE_MS });
        const article = stateRef.current.articles[idx];
        if (!article) return;
        if (window.location.pathname !== article.href) {
          window.history.replaceState(
            { ...(window.history.state as object), mamagoContinuousArticleId: article.id },
            "",
            article.href,
          );
        }
        if (document.title !== article.documentTitle) {
          document.title = article.documentTitle;
        }
        if (idx > 0) {
          analyticsRef.current.track(
            "next_article_started",
            article.id,
            article.slug,
            analyticsCtx(
              article.id,
              idx + 1,
              stateRef.current.articles[idx - 1]?.id ?? null,
            ),
          );
        }
      }, ACTIVE_STABLE_MS);
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        measure();
      });
    };

    const articleObs = new IntersectionObserver(() => measure(), {
      root: null,
      threshold: [0, 0.25, 0.5, 0.75, 1],
      rootMargin: "-20% 0px -40% 0px",
    });
    articleElsRef.current.forEach((node) => articleObs.observe(node));
    window.addEventListener("scroll", onScroll, { passive: true });
    measure();

    return () => {
      articleObs.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
    };
  }, [analyticsCtx, dispatch, state.articles.length]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const impressionObs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-article-id");
          const slug = entry.target.getAttribute("data-article-slug");
          const pos = Number(entry.target.getAttribute("data-article-pos") || "1");
          if (!id || !slug) continue;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.2) {
            analyticsRef.current.track(
              "article_impression",
              id,
              slug,
              analyticsCtx(id, pos, null),
            );
          }
        }
      },
      { threshold: [0, 0.2, 0.5] },
    );
    const viewObs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-article-id");
          const slug = entry.target.getAttribute("data-article-slug");
          const pos = Number(entry.target.getAttribute("data-article-pos") || "1");
          if (!id || !slug) continue;
          const existing = viewTimersRef.current.get(id);
          if (entry.isIntersecting && entry.intersectionRatio >= VIEW_RATIO) {
            if (existing) continue;
            const t = setTimeout(() => {
              analyticsRef.current.track(
                "article_view",
                id,
                slug,
                analyticsCtx(id, pos, null),
              );
              viewTimersRef.current.delete(id);
            }, VIEW_DWELL_MS);
            viewTimersRef.current.set(id, t);
          } else if (existing) {
            clearTimeout(existing);
            viewTimersRef.current.delete(id);
          }
        }
      },
      { threshold: [0, VIEW_RATIO, 0.75, 1] },
    );
    articleElsRef.current.forEach((node) => {
      impressionObs.observe(node);
      viewObs.observe(node);
    });
    return () => {
      impressionObs.disconnect();
      viewObs.disconnect();
      viewTimersRef.current.forEach((t) => clearTimeout(t));
      viewTimersRef.current.clear();
    };
  }, [analyticsCtx, state.articles.length, loaded.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        articleElsRef.current.forEach((el, index) => {
          const id = el.getAttribute("data-article-id");
          const slug = el.getAttribute("data-article-slug");
          if (!id || !slug) return;
          const rect = el.getBoundingClientRect();
          const total = Math.max(1, rect.height - window.innerHeight * 0.2);
          const scrolled = Math.min(
            total,
            Math.max(0, -rect.top + window.innerHeight * 0.35),
          );
          const ratio = Math.min(1, scrolled / total);
          const prev = progressPrevRef.current.get(id) ?? 0;
          const crossed = progressBucketsCrossed(prev, ratio);
          progressPrevRef.current.set(id, Math.max(prev, ratio));
          for (const bucket of crossed) {
            const kind =
              bucket === 100
                ? "article_complete"
                : (`article_read_${bucket}` as const);
            analyticsRef.current.track(
              kind,
              id,
              slug,
              analyticsCtx(id, index + 1, null),
              { progress: bucket },
            );
          }
        });
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [analyticsCtx, state.articles.length]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const setArticleEl = (index: number, node: HTMLElement | null) => {
    if (node) articleElsRef.current.set(index, node);
    else articleElsRef.current.delete(index);
  };

  return (
    <div className="bg-white">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>

      <div
        ref={(n) => setArticleEl(0, n)}
        data-article-id={seed.id}
        data-article-slug={seed.slug}
        data-article-pos={1}
      >
        {firstArticleSlot}
      </div>

      <ArticleIntermission
        article={{ id: seed.id, slug: seed.slug }}
        analytics={{
          articleId: seed.id,
          articleSlug: seed.slug,
          sectionId: section.id,
          sectionSlug: section.slug,
          cityId,
          citySlug,
          sessionPosition: 1,
        }}
        showNextLabel={
          loaded.length > 0 || state.loadStatus !== "exhausted"
        }
      />

      {loaded.map((article, i) => {
        const index = i + 1;
        const isLastLoaded = i === loaded.length - 1;
        return (
          <div key={article.id}>
            <div
              ref={(n) => setArticleEl(index, n)}
              data-article-id={article.id}
              data-article-slug={article.slug}
              data-article-pos={index + 1}
            >
              <ArticleMvpView
                title={article.title}
                subtitle={article.subtitle}
                excerpt={article.excerpt}
                publishedAt={article.publishedAt}
                blocks={article.blocks}
                tags={article.tags}
                categoryLabel={article.categoryLabel}
                citySlug={citySlug}
                continuousVariant="continuation"
                articleAriaLabel={article.title}
                journalFooterHref={journalHref}
                articleId={article.id}
                articleHref={article.href}
                coverImageUrl={article.heroUrl}
              />
            </div>
            <ArticleIntermission
              article={{ id: article.id, slug: article.slug }}
              analytics={{
                articleId: article.id,
                articleSlug: article.slug,
                sectionId: section.id,
                sectionSlug: section.slug,
                cityId,
                citySlug,
                sessionPosition: index + 1,
              }}
              showNextLabel={
                !isLastLoaded || state.loadStatus !== "exhausted"
              }
            />
          </div>
        );
      })}

      <div ref={prefetchSentinelRef} className="h-px w-full" aria-hidden />

      {state.loadStatus === "loading" ? (
        <p className="max-w-3xl mx-auto px-4 sm:px-6 py-4 text-sm text-muted-foreground text-center">
          Загружаем следующую статью…
        </p>
      ) : null}

      {state.loadStatus === "error" ? (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Не удалось загрузить следующую статью
          </p>
          <button
            type="button"
            className="text-sm text-primary hover:underline underline-offset-2"
            onClick={() => {
              dispatch({ type: "RETRY" });
              void fetchNext();
            }}
          >
            Попробовать снова
          </button>
        </div>
      ) : null}

      {state.loadStatus === "exhausted" ? (
        <ArticleSectionExhausted
          sectionName={section.name}
          journalHref={journalHref}
        />
      ) : (
        <footer className="max-w-3xl mx-auto px-4 sm:px-6 mt-6 mb-16 pt-6 border-t border-border/60 text-sm text-muted-foreground">
          <a
            href={journalHref}
            className="text-primary hover:underline underline-offset-2"
          >
            ← Все материалы
          </a>
        </footer>
      )}
    </div>
  );
}
