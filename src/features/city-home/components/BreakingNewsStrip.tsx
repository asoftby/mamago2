import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
 * Блок Breaking News: заголовок и горизонтальная лента с фото-карточками.
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
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-1">
        <h2 className="text-lg font-semibold text-neutral-900 leading-tight tracking-tight">
          Breaking News
        </h2>
        <Link
          href={allNewsHref}
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            "bg-neutral-200 text-neutral-900 transition-colors hover:bg-neutral-300/90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
          aria-label="Все новости"
        >
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
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
