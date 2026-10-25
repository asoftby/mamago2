"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
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
  const activeRef = useRef<HTMLAnchorElement>(null);
  const base = buildPublicPath(buildCityPublicPath({ citySlug, type: "journal" }));
  const activeSlug = pathname.startsWith(`${base}/category/`)
    ? pathname.slice(`${base}/category/`.length).split("/")[0]
    : null;

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

  const pills = [
    { id: "all", slug: null, name: "Все" },
    ...categories.map((category) => ({ id: category.id, slug: category.slug, name: category.name })),
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
              className={`shrink-0 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary/50"}`}
            >
              {pill.name}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
