"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Resting bottom of the plan pill (`12px + safe-area`). */
const PLAN_BOTTOM_PX = 12;
/** Beta tip sits 10px above the 56px plan capsule → 12 + 56 + 6 = 74. */
const BETA_ABOVE_PLAN_PX = 74;
/** How far the tip slides down when the plan tucks away (stays on-screen). */
const BETA_TUCK_DELTA_PX = BETA_ABOVE_PLAN_PX - PLAN_BOTTOM_PX;

const STORAGE_KEY = "beta-tip-dismissed";

function useBetaTipVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showId = window.setTimeout(() => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    }, 0);
    return () => window.clearTimeout(showId);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  return { visible, dismiss };
}

function BetaTipContent({
  variant,
  onDismiss,
}: {
  variant: "mobile" | "desktop";
  onDismiss: () => void;
}) {
  const isMobile = variant === "mobile";

  return (
    <div
      className={cn(
        "flex items-center gap-2 pointer-events-auto",
        "border border-white/60",
        "bg-white/35 backdrop-blur-2xl backdrop-saturate-150",
        "text-neutral-800",
        isMobile
          ? [
              "rounded-[20px] px-4 py-2.5",
              "shadow-[0_2px_16px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.7)]",
            ]
          : [
              "rounded-full px-4 py-3.5 h-[80px]",
              "shadow-[0_16px_30px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.7)]",
            ],
      )}
    >
      <div className="flex-1 text-[13px] leading-snug">
        Это beta версия. Что-то сломалось?{" "}
        <a
          href="https://t.me/shapovalovalexey"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2 decoration-neutral-500/60"
        >
          Напишите сюда
        </a>
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-black/8 text-neutral-500 hover:bg-black/14 hover:text-neutral-700 transition-colors"
        aria-label="Закрыть"
      >
        <X size={11} strokeWidth={2.5} />
      </button>
    </div>
  );
}

/**
 * Мобильный баннер над «Мой план».
 * `tucked` — тот же scroll-сигнал, что у пилюли: опускается к низу, но остаётся видимым.
 */
export function BetaTipMobile({
  tucked = false,
  dockAbovePlan = true,
}: {
  tucked?: boolean;
  /** When false (no plan pill), sit near the bottom edge instead of above the pill. */
  dockAbovePlan?: boolean;
}) {
  const { visible, dismiss } = useBetaTipVisible();

  if (!visible) return null;

  const restingBottom = dockAbovePlan ? BETA_ABOVE_PLAN_PX : PLAN_BOTTOM_PX;

  return (
    <div
      className="pointer-events-none fixed z-50 left-3 right-3 transition-transform duration-[220ms] ease-out motion-reduce:transition-none lg:hidden"
      style={{
        bottom: `calc(${restingBottom}px + env(safe-area-inset-bottom, 0px))`,
        transform:
          tucked && dockAbovePlan
            ? `translate3d(0, ${BETA_TUCK_DELTA_PX}px, 0)`
            : "translate3d(0, 0, 0)",
      }}
    >
      <BetaTipContent variant="mobile" onDismiss={dismiss} />
    </div>
  );
}

/** Десктопный баннер — фиксирован внизу слева. */
export function BetaTip() {
  const { visible, dismiss } = useBetaTipVisible();

  if (!visible) return null;

  return (
    <div className="hidden lg:block fixed z-50 left-4 bottom-4 w-[min(100vw-2rem,280px)] animate-in fade-in slide-in-from-bottom-4 pointer-events-none">
      <BetaTipContent variant="desktop" onDismiss={dismiss} />
    </div>
  );
}
