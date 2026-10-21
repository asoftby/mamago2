"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getOrderedMasonryRowSpan } from "./orderedMasonryGeometry";

const GRID_ROW_PX = 8;
const GRID_GAP_PX = 8;

function OrderedMasonryCell({
  children,
  active,
  itemClassName,
}: {
  children: ReactNode;
  active: boolean;
  itemClassName?: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [rowSpan, setRowSpan] = useState(1);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const update = () => {
      const height = content.getBoundingClientRect().height;
      const next = getOrderedMasonryRowSpan(height, GRID_ROW_PX, GRID_GAP_PX);
      setRowSpan((previous) => previous === next ? previous : next);
    };

    // Recalculate for text wrapping, images and viewport changes without
    // changing DOM order. A fallback grid still renders if observers are absent.
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(content);
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, []);

  return (
    <div className="min-w-0 self-start" style={active ? { gridRowEnd: `span ${rowSpan}` } : undefined}>
      <div ref={contentRef} className={cn("min-w-0", itemClassName)}>
        {children}
      </div>
    </div>
  );
}

/**
 * Pinterest-like heights with DOM and keyboard order remaining left-to-right,
 * top-to-bottom. Never use CSS columns or grid-auto-flow:dense for sorted ideas.
 *
 * SSR gracefully starts with a regular grid; JS progressively measures the
 * cells and switches to compact row-span placement after hydration.
 */
export function OrderedMasonryGrid({
  children,
  className,
  itemClassName,
}: {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setActive(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={cn(
        "grid w-full min-w-0 grid-flow-row grid-cols-2 gap-x-3 sm:gap-x-6 lg:grid-cols-4",
        active ? "gap-y-2 [grid-auto-rows:8px]" : "items-start gap-y-6",
        className,
      )}
    >
      {Children.map(children, (child) => (
        <OrderedMasonryCell active={active} itemClassName={itemClassName}>
          {child}
        </OrderedMasonryCell>
      ))}
    </div>
  );
}
