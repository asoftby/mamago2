"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { buildPublicPath } from "@/lib/routing/surface";
import { buildCityPublicPath } from "@/lib/routing/cityPaths";
import type { CityBlogCategory } from "@/server/article/cityBlogCategories";

/** Kept in the shared journal layout so it survives section transitions. */
export function BlogPersistentNav({ citySlug, categories }: {
  citySlug: string;
  categories: CityBlogCategory[];
}) {
  const pathname = usePathname();
  const [articleSection, setArticleSection] = useState<string | null>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const base = buildPublicPath(buildCityPublicPath({ citySlug, type: "journal" }));
  const sectionPrefix = `${base}/category/`;
  const articlePrefix = `${base}/`;
  const isArticle = pathname.startsWith(articlePrefix) && !pathname.startsWith(sectionPrefix) && pathname !== base;
  const activeSlug = pathname.startsWith(sectionPrefix)
    ? pathname.slice(sectionPrefix.length).split("/")[0]
    : isArticle ? articleSection : null;

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
  }, [activeSlug]);

  const collageCovers = categories.map((category) => category.thumbnailUrl).filter((url): url is string => Boolean(url)).slice(0, 4);
  const pills = [
    { id: "all", slug: null, name: "Все", thumbnailUrl: null, hasNewArticle: false },
    ...categories.map((category) => ({ id: category.id, slug: category.slug, name: category.name, thumbnailUrl: category.thumbnailUrl, hasNewArticle: category.hasNewArticle })),
  ];

  return (
    <section className="border-b border-border" aria-label="Разделы журнала">
      <nav className="site-wrap no-scrollbar flex h-[72px] items-center gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap px-6 sm:px-7" aria-label="Разделы журнала">
        {pills.map((pill) => {
          const active = pill.slug === activeSlug;
          return (
            <Link
              key={pill.id}
              ref={active ? activeRef : undefined}
              href={pill.slug ? buildPublicPath(`${base}/category/${pill.slug}`) : base}
              prefetch
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-14 shrink-0 items-center gap-3 rounded-full border pl-1.5 pr-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary/50"}`}
            >
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
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
                  {pill.slug && pill.hasNewArticle && <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-primary" />}
                </span>
              {pill.name}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
