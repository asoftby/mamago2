"use client";

import { useEffect, useRef, type ReactNode, type TouchEvent } from "react";
import { isEdgeSwipeBack } from "../../lib/dayScenarioUi/model";

/**
 * One screen of the day scenario's stack: slides in from the right over the screen below it, like
 * the widget's own nested screens. The screen below stays mounted (the draft, scroll position and
 * filters survive) but is inert. Back is the screen's own "‹" button or a swipe from the left edge.
 */
export function ScenarioStackLayer({ children, active, onBack, label }: { children: ReactNode; active: boolean; onBack: () => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Focus moves into the new screen and returns to what opened it when the screen goes away.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    return () => {
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

  const rect = () => ref.current?.getBoundingClientRect();
  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    const box = rect();
    // Coordinates are relative to the layer, so an edge swipe works wherever the widget sits on the page.
    touchStart.current = touch && box ? { x: touch.clientX - box.left, y: touch.clientY - box.top } : null;
  };
  const onTouchEnd = (event: TouchEvent) => {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    const box = rect();
    touchStart.current = null;
    if (!active || !start || !touch || !box) return;
    if (isEdgeSwipeBack(start, { x: touch.clientX - box.left, y: touch.clientY - box.top })) onBack();
  };

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      inert={!active}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="absolute inset-0 z-30 flex min-h-0 flex-col bg-[var(--mp-bg)] duration-300 animate-in slide-in-from-right motion-reduce:animate-none"
    >
      {children}
    </div>
  );
}
