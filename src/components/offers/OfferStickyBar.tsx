"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OfferStickyBarProps {
  ctaRef?: React.RefObject<HTMLDivElement | null>;
  title: string;
  priceLabel: string;
  primaryLabel: string;
  secondaryLabel?: string;
  isPrimaryLoading?: boolean;
  isSecondaryLoading?: boolean;
  isInPlan?: boolean;
  onPrimary: () => void;
  onSecondary?: () => void;
}

/**
 * Sticky Action Bar
 * Desktop: появляется после scroll hero, compact sticky top bar
 * Mobile: sticky bottom bar
 */
export function OfferStickyBar({
  ctaRef,
  title,
  priceLabel,
  primaryLabel,
  secondaryLabel,
  isPrimaryLoading = false,
  isSecondaryLoading = false,
  isInPlan = false,
  onPrimary,
  onSecondary,
}: OfferStickyBarProps) {
  const [visible, setVisible] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const hasSecondary = Boolean(secondaryLabel && onSecondary);

  // Снимаем фокус при скрытии бара
  useEffect(() => {
    if (visible) return;
    const el = barRef.current;
    if (!el) return;
    if (el.contains(document.activeElement) && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [visible]);

  useEffect(() => {
    // Читаем .current один раз при монтировании — ref стабилен, зависимость не нужна
    const el = ctaRef?.current ?? null;

    const syncFromScroll = () => {
      if (el) {
        const rect = el.getBoundingClientRect();
        setVisible(rect.bottom <= 0);
        return;
      }
      setVisible(window.scrollY > 400);
    };

    // Use requestAnimationFrame to avoid "update during render" or "not mounted" warnings
    const rafId = requestAnimationFrame(syncFromScroll);

    if (!("IntersectionObserver" in window) || !el) {
      window.addEventListener("scroll", syncFromScroll, { passive: true });
      window.addEventListener("resize", syncFromScroll);
      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener("scroll", syncFromScroll);
        window.removeEventListener("resize", syncFromScroll);
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!(entry?.isIntersecting ?? true)),
      { threshold: 0 },
    );
    observer.observe(el);
    window.addEventListener("scroll", syncFromScroll, { passive: true });
    window.addEventListener("resize", syncFromScroll);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("scroll", syncFromScroll);
      window.removeEventListener("resize", syncFromScroll);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // намеренно пустой массив — ref стабилен, el читается один раз при монтировании

  return (
    <>
      {/* Desktop: Top Sticky Bar */}
      <div
        ref={barRef}
        className={cn(
          "hidden lg:block",
          "fixed inset-x-0 top-0 z-[60]",
          "transition-all duration-500 ease-in-out",
          visible 
            ? "translate-y-0 opacity-100 pointer-events-auto" 
            : "-translate-y-full opacity-0 pointer-events-none",
          "border-b border-border/40 bg-white/90 backdrop-blur-xl shadow-lg shadow-black/5"
        )}
      >
        <div className="mx-auto flex h-20 max-w-[1360px] items-center justify-between px-10">
          <div className="flex items-center gap-6 overflow-hidden">
            <p className="truncate text-[18px] font-bold text-foreground">
              {title}
            </p>
            <div className="h-4 w-[1px] bg-border/60 shrink-0" />
            <p className="text-[16px] font-bold text-[#EF8759]">
              {priceLabel}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {hasSecondary && (
              <Button
                variant="outline"
                size="lg"
                onClick={onSecondary}
                disabled={isSecondaryLoading}
                className={cn(
                  "h-12 rounded-xl px-6 text-[14px] font-bold transition-all",
                  isInPlan 
                    ? "border-[#EF8759] bg-[#FFF7F3] text-[#EF8759]" 
                    : "border-border/80 hover:bg-neutral-50"
                )}
              >
                {isInPlan ? <Check className="mr-2 h-4 w-4" /> : null}
                {isInPlan ? "В плане" : "В план"}
              </Button>
            )}
            <Button
              size="lg"
              onClick={onPrimary}
              disabled={isPrimaryLoading}
              className="h-12 rounded-xl bg-[#EF8759] px-8 text-[14px] font-bold text-white shadow-md hover:bg-[#EF8759]/90 transition-all"
            >
              {isPrimaryLoading ? "..." : primaryLabel}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile: Bottom Sticky Bar */}
      <div
        className={cn(
          "lg:hidden",
          "fixed inset-x-0 bottom-0 z-50",
          "transition-transform duration-300 ease-in-out",
          "bg-white border-t border-border/40 shadow-[0_-8px_30px_rgba(0,0,0,0.1)]",
          "px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-bold text-foreground">
              {title}
            </p>
            <p className="text-[16px] font-bold text-[#EF8759]">
              {priceLabel}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {hasSecondary && (
              <Button
                variant="outline"
                size="icon"
                onClick={onSecondary}
                disabled={isSecondaryLoading}
                className={cn(
                  "h-12 w-12 rounded-xl transition-all",
                  isInPlan 
                    ? "border-[#EF8759] bg-[#FFF7F3] text-[#EF8759]" 
                    : "border-border/80"
                )}
              >
                <Check className={cn("h-5 w-5", !isInPlan && "hidden")} />
                {!isInPlan && <span className="text-[12px] font-bold">В план</span>}
              </Button>
            )}
            <Button
              onClick={onPrimary}
              disabled={isPrimaryLoading}
              className="h-12 rounded-xl bg-[#EF8759] px-6 text-[14px] font-bold text-white shadow-lg"
            >
              {isPrimaryLoading ? "..." : primaryLabel}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
