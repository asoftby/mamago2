"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ChipItem = {
  id: string;
  label: React.ReactNode;
  /** Иконка слева (возраст, категории и т.п.) */
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

function ChipButton({
  it,
  layout,
}: {
  it: ChipItem;
  layout: "scroll" | "wrap" | "masonry";
}) {
  const isActive = !!it.active;

  /** Возраст: пилюля по ширине текста, перенос строки — flex-wrap, не CSS columns */
  if (layout === "masonry") {
    const hasIcon = !!it.icon;
    if (hasIcon) {
      return (
        <button
          type="button"
          disabled={it.disabled}
          onClick={it.onClick}
          className={cn(
            "flex w-full min-h-[3.5rem] items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
            "disabled:pointer-events-none disabled:opacity-50",
            isActive
              ? "border-[#EF8759] bg-[#EF8759]/5 text-[#EF8759]"
              : "border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50",
            it.className,
          )}
        >
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              isActive ? "bg-[#EF8759]/10" : "bg-gray-100",
            )}
          >
            <span className={cn(isActive ? "text-[#EF8759]" : "text-gray-600")}>
              {it.icon}
            </span>
          </span>
          <span className="min-w-0 flex-1 leading-snug">{it.label}</span>
        </button>
      );
    }
    return (
      <button
        type="button"
        disabled={it.disabled}
        onClick={it.onClick}
        className={cn(
          "inline-flex max-w-full shrink-0 items-center justify-center rounded-full border px-5 py-2.5 text-sm font-medium text-gray-900 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759]/35 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          isActive
            ? "border-transparent bg-[#F8C4B4]"
            : "border-gray-200 bg-gray-100 hover:bg-gray-50",
          it.className,
        )}
      >
        <span className="whitespace-nowrap leading-snug">{it.label}</span>
      </button>
    );
  }

  const labelContent =
    it.icon && layout !== "scroll" ? (
      <span className="inline-flex items-center gap-2">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            isActive ? "bg-primary/15" : "bg-muted",
          )}
        >
          {it.icon}
        </span>
        {it.label}
      </span>
    ) : it.icon && layout === "scroll" ? (
      <span className="inline-flex items-center gap-2">
        {it.icon}
        {it.label}
      </span>
    ) : (
      it.label
    );

  return (
    <button
      type="button"
      disabled={it.disabled}
      onClick={it.onClick}
      className={cn(
        "min-h-[2.75rem] shrink-0 rounded-full border bg-background px-5 text-sm font-medium text-foreground transition-colors",
        "disabled:pointer-events-none disabled:opacity-50",
        layout === "wrap" && "whitespace-normal text-center",
        isActive ? "border-primary/50 bg-primary/50" : "border-border",
        it.className,
      )}
    >
      {labelContent}
    </button>
  );
}

export function ChipsRow({
  items,
  className,
  /** Выравнивание переносимых чипов (`masonry`) по главной оси */
  justifyWrap = "start",
  /** `scroll` — горизонтальный ряд; `wrap` — перенос; `masonry` — возраст: пилюли по ширине текста + перенос (flex-wrap), без колонок */
  layout = "scroll",
  "aria-label": ariaLabel,
}: {
  items: ChipItem[];
  className?: string;
  justifyWrap?: "start" | "center";
  layout?: "scroll" | "wrap" | "masonry";
  "aria-label"?: string;
}) {
  if (layout === "masonry") {
    return (
      <div className={cn("w-full", className)}>
        <div
          role={ariaLabel ? "group" : undefined}
          aria-label={ariaLabel}
          className={cn(
            "flex flex-wrap items-start gap-2 [align-content:flex-start]",
            justifyWrap === "center" && "justify-center",
          )}
        >
          {items.map((it) => (
            <ChipButton key={it.id} it={it} layout="masonry" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        role={ariaLabel ? "group" : undefined}
        aria-label={ariaLabel}
        className={cn(
          "flex",
          layout === "wrap"
            ? "[align-content:flex-start] flex-wrap items-start gap-2 py-1"
            : "no-scrollbar items-center gap-3 overflow-x-auto whitespace-nowrap py-2",
        )}
      >
        {items.map((it) => (
          <ChipButton key={it.id} it={it} layout={layout} />
        ))}
      </div>
    </div>
  );
}
