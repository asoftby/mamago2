"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

  const updateButtons = useMemo(() => {
    return () => {
      const el = scrollerRef.current;
      if (!el) return;
      // Small epsilon for fractional pixels
      const eps = 2;
      setCanLeft(el.scrollLeft > eps);
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - eps);
    };
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
    const delta = Math.round(el.clientWidth * 0.9) * (dir === "left" ? -1 : 1);
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div
      className={cn("relative -mx-4 px-4 sm:mx-0 sm:px-0", padded && "pb-1")}
    >
      {/* Desktop nav: optional leading link + Airbnb-style arrows */}
      <div className="absolute right-0 -top-12 flex items-center justify-end gap-3">
        {navLeading ? (
          <div className="flex h-8 items-center">{navLeading}</div>
        ) : null}
        <div className="hidden lg:flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByPage("left")}
            disabled={!canLeft}
            aria-label="Прокрутить назад"
            className={cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              "bg-neutral-200 text-neutral-900 transition-colors hover:bg-neutral-300/90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              canLeft
                ? "opacity-100"
                : "opacity-30 cursor-default hover:bg-neutral-200",
            )}
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => scrollByPage("right")}
            disabled={!canRight}
            aria-label="Прокрутить вперёд"
            className={cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              "bg-neutral-200 text-neutral-900 transition-colors hover:bg-neutral-300/90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              canRight
                ? "opacity-100"
                : "opacity-30 cursor-default hover:bg-neutral-200",
            )}
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>

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
