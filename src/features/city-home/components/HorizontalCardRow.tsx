"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type HorizontalCardRowProps = {
  children: React.ReactNode;
  className?: string;
  /** Доп. отступ снизу для тени скролла */
  padded?: boolean;
  /** Контент слева от стрелок карусели (например текстовая ссылка «все события») */
  navLeading?: React.ReactNode;
};

/**
 * Горизонтальный ряд карточек с нативным скроллом (паттерн как в Airbnb-лентах).
 */
export function HorizontalCardRow({
  children,
  className,
  padded = true,
  navLeading,
}: HorizontalCardRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateButtons = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // Small epsilon for fractional pixels.
    const eps = 2;
    setCanLeft(el.scrollLeft > eps);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - eps);
  }, []);

  useEffect(() => {
    updateButtons();
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => updateButtons();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => updateButtons());
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [updateButtons]);

  const scrollByPage = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const cards = Array.from(el.children) as HTMLElement[];
    if (cards.length === 0) return;

    // Move by the number of full cards currently visible: two on phones,
    // four on wide event rows. Using card positions keeps snap points exact.
    const scrollerLeft = el.getBoundingClientRect().left;
    const positions = cards.map(
      (card) => card.getBoundingClientRect().left - scrollerLeft + el.scrollLeft,
    );
    const cardWidth = cards[0].getBoundingClientRect().width;
    const gap = cards.length > 1 ? Math.max(0, positions[1] - positions[0] - cardWidth) : 0;
    const visibleCount = Math.max(
      1,
      Math.floor((el.clientWidth + gap + 1) / (cardWidth + gap)),
    );
    const currentIndex = positions.reduce(
      (current, position, index) => (position <= el.scrollLeft + 2 ? index : current),
      0,
    );
    const direction = dir === "left" ? -1 : 1;
    const targetIndex = Math.max(0, Math.min(cards.length - 1, currentIndex + direction * visibleCount));
    el.scrollTo({ left: positions[targetIndex], behavior: "smooth" });
  };

  const navigationControls = (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => scrollByPage("left")}
        disabled={!canLeft}
        aria-label="Предыдущие публикации"
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-full",
          "bg-muted text-foreground transition-colors hover:bg-muted/80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          !canLeft && "cursor-default opacity-30",
        )}
      >
        <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => scrollByPage("right")}
        disabled={!canRight}
        aria-label="Следующие публикации"
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-full",
          "bg-muted text-foreground transition-colors hover:bg-muted/80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          !canRight && "cursor-default opacity-30",
        )}
      >
        <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );

  return (
    <div className={cn("relative -mx-4 px-4 sm:mx-0 sm:px-0", padded && "pb-1")}>
      {navLeading ? (
        <div className="mb-4 flex min-h-9 items-center justify-between gap-3 px-1 sm:px-0">
          <div className="min-w-0">{navLeading}</div>
          {navigationControls}
        </div>
      ) : (
        <div className="absolute right-0 -top-12 hidden lg:flex">
          {navigationControls}
        </div>
      )}

      <div
        ref={scrollerRef}
        className={cn(
          // Add end gutter so last card doesn't feel clipped (Airbnb-style).
          "flex flex-nowrap gap-3 sm:gap-4 lg:gap-6 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory",
          "scroll-ps-4 scroll-pe-4 pe-4 sm:pe-0",
          className,
        )}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>
    </div>
  );
}
