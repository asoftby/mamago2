"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";

export interface EventStickyActionBarProps {
  ctaRef?: React.RefObject<HTMLElement | null>;
  sessionLine?: string;
  priceLabel: string;
  primaryLabel: string;
  onPrimary: () => void;
  /** Если передан — показывает сердечко-кнопку рядом с primary */
  onPlan?: () => void;
  isPlanned?: boolean;
  isPrimaryLoading?: boolean;
  isPlanLoading?: boolean;
  isPrimaryDisabled?: boolean;
  /** Если false — кнопка «Купить» не отображается нигде */
  hasPurchaseUrl?: boolean;
  className?: string;
}

export function EventStickyActionBar({
  ctaRef,
  sessionLine,
  priceLabel,
  primaryLabel,
  onPrimary,
  onPlan,
  isPlanned = false,
  isPrimaryLoading = false,
  isPlanLoading = false,
  isPrimaryDisabled = false,
  hasPurchaseUrl = true,
  className,
}: EventStickyActionBarProps) {
  const [ctaPassed, setCtaPassed] = useState(false);

  /* Show desktop top-bar when CTA scrolls out of view */
  useEffect(() => {
    const el = ctaRef?.current;
    const syncFromScroll = () => {
      if (el) {
        setCtaPassed(el.getBoundingClientRect().bottom <= 0);
        return;
      }
      setCtaPassed(window.scrollY > 280);
    };
    syncFromScroll();
    if (!("IntersectionObserver" in window) || !el) {
      window.addEventListener("scroll", syncFromScroll, { passive: true });
      return () => window.removeEventListener("scroll", syncFromScroll);
    }
    const observer = new IntersectionObserver(
      ([entry]) => setCtaPassed(!(entry?.isIntersecting ?? true)),
      { threshold: 0 },
    );
    observer.observe(el);
    window.addEventListener("scroll", syncFromScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", syncFromScroll);
    };
  }, [ctaRef]);

  /* ── Desktop top sticky bar (shown when CTA is out of view) ── */
  const TopBar = (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-40 hidden lg:block",
        "transition-transform duration-200 ease-out",
        ctaPassed ? "translate-y-0 pointer-events-auto" : "-translate-y-full pointer-events-none",
        "border-b border-[rgba(20,18,16,0.10)] bg-[rgba(250,247,241,0.95)] backdrop-blur-md",
        "shadow-[0_4px_20px_rgba(20,18,16,0.08)]",
        "py-3",
        className,
      )}
      role="region"
      aria-label="Действия с событием"
      aria-hidden={!ctaPassed}
    >
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          {sessionLine && (
            <p className="truncate font-mono text-[11px] uppercase tracking-[0.06em] text-[#C24E22]">
              {sessionLine}
            </p>
          )}
          {(() => {
            const spaceIdx = (priceLabel ?? "").lastIndexOf(" ");
            const numPart = spaceIdx !== -1 ? priceLabel.slice(0, spaceIdx) : priceLabel;
            const currencyPart = spaceIdx !== -1 ? priceLabel.slice(spaceIdx + 1) : "";
            return (
              <div className="flex items-baseline gap-1">
                <span style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 36, fontWeight: 400, lineHeight: 1, letterSpacing: "-0.03em", color: "#141210" }}>
                  {numPart}
                </span>
                {currencyPart && (
                  <span className="text-[11px] text-[rgba(20,18,16,0.55)]" style={{ fontFamily: "Menlo, monospace" }}>
                    {currencyPart}
                  </span>
                )}
              </div>
            );
          })()}
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          {/* Buy button — shown only when purchase URL exists */}
          {hasPurchaseUrl && (
            <button
              type="button"
              onClick={onPrimary}
              disabled={isPrimaryDisabled || isPrimaryLoading}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[#E86A3A] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#C24E22]"
            >
              {isPrimaryLoading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <>{primaryLabel} <span aria-hidden>→</span></>
              )}
            </button>
          )}
          {/* Plan / heart button */}
          {onPlan && (
            <button
              type="button"
              onClick={onPlan}
              disabled={isPlanLoading}
              aria-label={isPlanned ? "В плане" : "Добавить в план"}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors",
                isPlanned
                  ? "border-[#E86A3A] bg-[#FFE8DC] text-[#C24E22]"
                  : "border-[rgba(20,18,16,0.18)] text-[rgba(20,18,16,0.45)] hover:border-[#141210] hover:text-[#141210]",
              )}
            >
              {isPlanLoading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Heart size={16} strokeWidth={1.75} className={isPlanned ? "fill-[#C24E22]" : ""} />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  /* ── Mobile bottom bar (always visible on small screens) ── */
  const BottomBar = (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex lg:hidden",
        "items-center gap-3 px-3.5 py-2.5",
        "border-t border-[rgba(20,18,16,0.10)] bg-[rgba(250,247,241,0.95)] backdrop-blur-[14px]",
        "shadow-[0_-10px_30px_-10px_rgba(20,18,16,0.18)]",
        "pb-[calc(0.625rem+env(safe-area-inset-bottom))]",
      )}
      role="region"
      aria-label="Действия с событием"
    >
      <div className="flex-1 min-w-0">
        {sessionLine && (
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#C24E22]">
            {sessionLine}
          </div>
        )}
        <div className="mt-0.5 flex items-baseline gap-1">
          {(() => {
            const spaceIdx = (priceLabel ?? "").lastIndexOf(" ");
            const numPart = spaceIdx !== -1 ? priceLabel.slice(0, spaceIdx) : priceLabel;
            const currencyPart = spaceIdx !== -1 ? priceLabel.slice(spaceIdx + 1) : "";
            return (
              <>
                <span style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 32, fontWeight: 400, lineHeight: 1, letterSpacing: "-0.03em", color: "#141210" }}>
                  {numPart}
                </span>
                {currencyPart && (
                  <span className="text-[11px] text-[rgba(20,18,16,0.55)]" style={{ fontFamily: "Menlo, monospace" }}>
                    {currencyPart}
                  </span>
                )}
              </>
            );
          })()}
          <span className="font-mono text-[11px] text-[rgba(20,18,16,0.55)]">· билет</span>
        </div>
      </div>
      {hasPurchaseUrl ? (
        <button
          type="button"
          onClick={onPrimary}
          disabled={isPrimaryDisabled || isPrimaryLoading}
          className="inline-flex h-[46px] shrink-0 items-center gap-2 rounded-full bg-[#E86A3A] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#C24E22] active:translate-y-px"
        >
          {isPrimaryLoading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <>Купить <span aria-hidden>→</span></>
          )}
        </button>
      ) : onPlan ? (
        <button
          type="button"
          onClick={onPlan}
          disabled={isPlanLoading}
          aria-label={isPlanned ? "В плане" : "Добавить в план"}
          className={cn(
            "flex h-[46px] shrink-0 items-center gap-2 rounded-full border px-5 text-[14px] font-semibold transition-colors",
            isPlanned
              ? "border-[#E86A3A] bg-[#FFE8DC] text-[#C24E22]"
              : "border-[rgba(20,18,16,0.18)] bg-transparent text-[#141210] hover:border-[#141210]",
          )}
        >
          {isPlanLoading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <>
              <Heart size={16} strokeWidth={1.75} className={isPlanned ? "fill-[#C24E22]" : ""} />
              {isPlanned ? "В плане" : "Добавить в план"}
            </>
          )}
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      {TopBar}
      {BottomBar}
    </>
  );
}
