"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { buildPublicPath } from "@/lib/routing/surface";
import { buildCityPublicPath } from "@/lib/routing/cityPaths";
import type { CityBlogCategory } from "@/server/article/cityBlogCategories";
import { JOURNAL_CHIP, JOURNAL_CHIP_THUMB } from "@/components/journal/journalCategoryChipStyles";

const JOURNAL_SEEN_KEY = "mamago.journal.article-seen.v1";

function readSeenArticles(): Set<string> {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(JOURNAL_SEEN_KEY) || "[]");
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

/** Kept in the shared journal layout so it survives section transitions. */
export function BlogPersistentNav({ citySlug, categories }: {
  citySlug: string;
  categories: CityBlogCategory[];
}) {
  const pathname = usePathname();
  const [articleSection, setArticleSection] = useState<string | null>(null);
  const [seenArticles, setSeenArticles] = useState<Set<string>>(new Set());
  const [priorityOrder, setPriorityOrder] = useState<string[] | null>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false });
  const base = buildPublicPath(buildCityPublicPath({ citySlug, type: "journal" }));
  const sectionPrefix = `${base}/category/`;
  const articlePrefix = `${base}/`;
  const isArticle = pathname.startsWith(articlePrefix) && !pathname.startsWith(sectionPrefix) && pathname !== base;
  const activeSlug = pathname.startsWith(sectionPrefix)
    ? pathname.slice(sectionPrefix.length).split("/")[0]
    : isArticle ? articleSection : null;

  useEffect(() => {
    const sync = () => setSeenArticles(readSeenArticles());
    const initialSeen = readSeenArticles();
    // Local storage is an external snapshot and is unavailable during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeenArticles(initialSeen);
    // Snapshot priority once per journal visit: chips never jump while reading.
    setPriorityOrder([...categories]
      .map((category, index) => ({
        id: category.id,
        index,
        latestUnread: Math.max(0, ...(category.recentArticles ?? [])
          .filter((article) => !initialSeen.has(article.id))
          .map((article) => Date.parse(article.publishedAt) || 0)),
      }))
      .sort((a, b) => b.latestUnread - a.latestUnread || a.index - b.index)
      .map((item) => item.id));
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, []);

  // Opening the actual publication marks that publication alone as seen.
  // Merely visiting its category leaves all unread indicators intact.
  useEffect(() => {
    const currentPath = pathname.replace(/\/$/, "");
    const matches = categories.flatMap((category) => category.recentArticles ?? [])
      .filter((article) => article.href.split("?")[0].replace(/\/$/, "") === currentPath)
      .map((article) => article.id);
    if (!matches.length) return;
    const next = readSeenArticles();
    if (matches.every((id) => next.has(id))) return;
    matches.forEach((id) => next.add(id));
    try { window.localStorage.setItem(JOURNAL_SEEN_KEY, JSON.stringify([...next])); } catch { /* Storage unavailable */ }
    // Synchronize the read marker after writing to browser storage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeenArticles(next);
  }, [pathname, categories]);

  useLayoutEffect(() => {
    const onArticleSection = (event: Event) => {
      const detail = (event as CustomEvent<{ slug: string | null }>).detail;
      setArticleSection(detail?.slug ?? null);
    };
    window.addEventListener("mamago:journal-article-section", onArticleSection);
    return () => window.removeEventListener("mamago:journal-article-section", onArticleSection);
  }, []);

  useLayoutEffect(() => {
    const active = activeRef.current;
    const scroller = active?.parentElement;
    if (!active || !scroller) return;
    const left = active.offsetLeft - scroller.offsetLeft;
    if (left < scroller.scrollLeft) scroller.scrollLeft = left;
    else if (left + active.offsetWidth > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollLeft = left + active.offsetWidth - scroller.clientWidth;
    }
  }, [activeSlug, priorityOrder]);

  // The scrollbar is visually hidden; desktop needs visible navigation controls.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const updateEdges = () => {
      const maxScroll = scroller.scrollWidth - scroller.clientWidth;
      setScrollEdges({
        left: scroller.scrollLeft > 2,
        right: maxScroll > 2 && scroller.scrollLeft < maxScroll - 2,
      });
    };
    updateEdges();
    scroller.addEventListener("scroll", updateEdges, { passive: true });
    const resizeObserver = new ResizeObserver(updateEdges);
    resizeObserver.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", updateEdges);
      resizeObserver.disconnect();
    };
  }, [categories, activeSlug]);

  const scrollCategories = (direction: -1 | 1) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * Math.max(240, scroller.clientWidth * 0.65), behavior: "smooth" });
  };

  const collageCovers = categories.map((category) => category.thumbnailUrl).filter((url): url is string => Boolean(url)).slice(0, 4);
  const hasUnseen = (category: CityBlogCategory) =>
    category.recentArticles
      ? category.recentArticles.some((article) => !seenArticles.has(article.id))
      : category.hasNewArticle;
  const sortedCategories = priorityOrder
    ? [...categories].sort((a, b) => priorityOrder.indexOf(a.id) - priorityOrder.indexOf(b.id))
    : categories;
  const pills = [
    { id: "all", slug: null, name: "Все", thumbnailUrl: null, hasNewArticle: categories.some(hasUnseen) },
    ...sortedCategories.map((category) => ({ id: category.id, slug: category.slug, name: category.name, thumbnailUrl: category.thumbnailUrl, hasNewArticle: hasUnseen(category) })),
  ];

  return (
    <section className="border-b border-border" aria-label="Разделы журнала">
      <div className="site-wrap relative">
      <nav ref={scrollRef} className="no-scrollbar flex h-[56px] items-center gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap px-6 sm:px-7" aria-label="Разделы журнала">
        {pills.map((pill) => {
          const active = pill.slug === activeSlug;
          return (
            <Link
              key={pill.id}
              ref={active ? activeRef : undefined}
              href={pill.slug ? buildPublicPath(`${base}/category/${pill.slug}`) : base}
              prefetch
              aria-current={active ? "page" : undefined}
              className={`${JOURNAL_CHIP} ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary/50"}`}
            >
              <span className={JOURNAL_CHIP_THUMB} aria-hidden="true">
                  <span className="h-full w-full overflow-hidden rounded-full">
                    {!pill.slug && collageCovers.length > 0 ? (
                      <span className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-background">
                        {Array.from({ length: 4 }, (_, i) => (
                          <span key={i} className="min-h-0 min-w-0 overflow-hidden">
                            <img src={collageCovers[i % collageCovers.length]} alt="" className="h-full w-full object-cover" />
                          </span>
                        ))}
                      </span>
                    ) : pill.thumbnailUrl ? (
                      <img src={pill.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-base">{pill.slug ? pill.name.slice(0, 1) : "Все".slice(0, 1)}</span>
                    )}
                  </span>
                  {pill.hasNewArticle && <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />}
                </span>
              {pill.name}
            </Link>
          );
        })}
      </nav>
      {scrollEdges.left && (
        <button
          type="button"
          onClick={() => scrollCategories(-1)}
          aria-label="Прокрутить разделы журнала влево"
          className="absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-colors hover:bg-muted sm:flex"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
      )}
      {scrollEdges.right && (
        <button
          type="button"
          onClick={() => scrollCategories(1)}
          aria-label="Прокрутить разделы журнала вправо"
          className="absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-colors hover:bg-muted sm:flex"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      )}
      </div>
    </section>
  );
}
