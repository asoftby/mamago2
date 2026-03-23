import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreakingNewsItem = {
  id: string;
  title: string;
  href: string;
  /** Полноэкранное фото карточки */
  imageUrl: string;
  /** Подпись времени, напр. «18 часов назад» */
  relativeTime: string;
};

type BreakingNewsStripProps = {
  items: BreakingNewsItem[];
  /** Куда ведёт «все новости» */
  allNewsHref?: string;
  className?: string;
};

/**
 * Блок Breaking News: заголовок, подзаголовок «СЕЙЧАС В ГОРОДЕ», горизонтальная лента с фото-карточками.
 * Без данных — не рендерится.
 */
export function BreakingNewsStrip({
  items,
  allNewsHref = "/blog",
  className,
}: BreakingNewsStripProps) {
  if (!items.length) return null;

  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-1">
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight leading-tight">
            Breaking News
          </h2>
          <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-[0.2em]">
            СЕЙЧАС В ГОРОДЕ
          </p>
        </div>
        <Link
          href={allNewsHref}
          className="inline-flex items-center gap-0.5 text-sm font-medium text-primary shrink-0 hover:opacity-90 transition-opacity"
        >
          Все новости
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <div className="relative">
        <div
          className={cn(
            "flex items-start justify-start gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain",
            "no-scrollbar snap-x snap-mandatory scroll-smooth pl-0 pr-4 sm:pr-6",
            "[touch-action:pan-x_pan-y]",
          )}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "group relative shrink-0 snap-start overflow-hidden rounded-xl",
                "w-[min(43vw,156px)] aspect-[3/4] sm:w-[144px] sm:aspect-[3/4]",
                "shadow-sm ring-1 ring-black/5 transition-transform hover:scale-[1.01]",
              )}
            >
              <Image
                src={item.imageUrl}
                alt={item.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 43vw, 144px"
              />
              <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-2.5 pb-3 pt-10">
                <span className="mb-[5px] block text-left text-[10px] font-medium text-white drop-shadow-md">
                  {item.relativeTime}
                </span>
                <p className="text-left text-xs font-semibold leading-[15.25px] text-white line-clamp-3 drop-shadow-sm">
                  {item.title}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
