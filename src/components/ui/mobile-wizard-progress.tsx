"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import type { WizardProgressStep } from "@/components/ui/wizard-progress";
import { cn } from "@/lib/utils";

interface MobileWizardProgressProps {
  steps: WizardProgressStep[];
  currentStep: number;
  onStepChange: (stepId: number) => void;
}

const VISIBLE_STEPS = 5;
const FIRST_AUTO_SCROLL_STEP = 4;

/**
 * Mobile-only progress navigation shared across all content wizards.
 * Native horizontal scrolling stays free/inertial (no scroll-snap).
 * The first automatic one-step shift happens on step 4.
 */
export function MobileWizardProgress({
  steps,
  currentStep,
  onStepChange,
}: MobileWizardProgressProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const didMountRef = useRef(false);
  const [canScrollBack, setCanScrollBack] = useState(false);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    // 1–3 => 1–5, 4 => 2–6, 5 => 3–7, ...; keep the last five in view.
    const firstVisibleIndex = Math.min(
      Math.max(currentStep - FIRST_AUTO_SCROLL_STEP + 1, 0),
      Math.max(steps.length - VISIBLE_STEPS, 0),
    );

    const alignSteps = (behavior: ScrollBehavior) => {
      // The mobile stepper is display:none at the sm breakpoint; wait until
      // it has real dimensions before applying pixel-based positioning.
      if (scroller.clientWidth === 0) return;
      const items = scroller.querySelectorAll<HTMLElement>("[data-wizard-step]");
      const first = items[0];
      const target = items[firstVisibleIndex];
      if (!first || !target) return;

      scroller.scrollTo({
        left: target.offsetLeft - first.offsetLeft,
        behavior,
      });
      setCanScrollBack(scroller.scrollLeft > 3);
    };

    alignSteps(didMountRef.current ? "smooth" : "auto");
    didMountRef.current = true;

    // Rotation, responsive resizing, and returning from the desktop breakpoint
    // change item widths without changing the current step. Re-align only on
    // dimension changes; free manual swipe scrolling is otherwise untouched.
    const onResize = () => alignSteps("auto");
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    observer?.observe(scroller);
    window.addEventListener("resize", onResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [currentStep, steps.length]);

  const scrollBack = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const firstStep = scroller.querySelector<HTMLElement>("[data-wizard-step]");
    const amount = firstStep ? firstStep.getBoundingClientRect().width + 8 : 72;
    scroller.scrollBy({ left: -amount, behavior: "smooth" });
  };

  return (
    <div className="relative w-full sm:hidden">
      <div
        ref={scrollerRef}
        role="tablist"
        aria-label="Шаги"
        onScroll={(event) => setCanScrollBack(event.currentTarget.scrollLeft > 3)}
        className="no-scrollbar flex w-full touch-pan-x gap-2 overflow-x-auto overscroll-x-contain pb-1"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {steps.map((step) => {
          const isActive = step.id === currentStep;
          const isDisabled = Boolean(step.isDisabled) && !isActive;
          const isOptionalEmpty = Boolean(step.isOptional) && !step.hasContent && !isActive;
          const isDone = Boolean(step.isComplete) && !isOptionalEmpty;

          return (
            <button
              key={step.id}
              data-wizard-step
              type="button"
              role="tab"
              aria-label={"Шаг " + step.id + ": " + step.label}
              aria-selected={isActive}
              disabled={isDisabled}
              onClick={() => onStepChange(step.id)}
              className={cn(
                "relative flex min-w-0 shrink-0 flex-col items-center gap-2 pb-3 pt-1",
                "w-[calc(20%-6.4px)] select-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                isDisabled ? "cursor-not-allowed" : "cursor-pointer",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : isDone
                      ? "bg-primary/85 text-primary-foreground"
                      : isOptionalEmpty
                        ? "border-2 border-dashed border-muted-foreground/30 text-muted-foreground"
                        : isDisabled
                          ? "bg-muted/50 text-muted-foreground/40"
                          : "bg-muted text-muted-foreground",
                )}
              >
                {step.id}
              </span>
              <span
                className={cn(
                  "block w-full truncate text-center text-[11px] leading-tight",
                  isActive ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute bottom-0 inset-x-0 h-0.5 rounded-full",
                  isActive
                    ? "bg-primary"
                    : isDone
                      ? "bg-primary/55"
                      : "bg-border",
                )}
              />
            </button>
          );
        })}
      </div>

      {canScrollBack && (
        <button
          type="button"
          aria-label="Показать предыдущие шаги"
          title="Предыдущие шаги"
          onClick={scrollBack}
          className="absolute -left-2 top-2 z-10 flex h-10 w-8 items-center justify-start rounded-r-full bg-background/95 text-primary shadow-sm backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
