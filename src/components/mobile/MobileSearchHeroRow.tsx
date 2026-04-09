"use client";

import { useState, type RefObject } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type MobileSearchHeroRowProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  inputId?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Только вид строки (главная: открытие поиска по клику на кнопку-обёртку) */
  decorative?: boolean;
};

/**
 * Крупная строка поиска (мобилка): иконка, поле, очистка.
 */
export function MobileSearchHeroRow({
  value,
  onChange,
  className,
  inputRef,
  inputId,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
  decorative = false,
}: MobileSearchHeroRowProps) {
  const [focused, setFocused] = useState(false);
  const queryTrim = value.trim();

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 shadow-sm transition-[box-shadow,border-color,ring] duration-200",
        focused
          ? "border-[#EF8759]/40 shadow-md ring-2 ring-[#EF8759]/25"
          : "border-neutral-200",
        className,
      )}
    >
      <Search className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden />
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        placeholder="Поиск событий, мест, маршрутов"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={decorative}
        tabIndex={decorative ? -1 : undefined}
        aria-hidden={decorative ? true : undefined}
        onFocus={() => {
          if (decorative) return;
          setFocused(true);
          onFocusProp?.();
        }}
        onBlur={() => {
          if (decorative) return;
          setFocused(false);
          onBlurProp?.();
        }}
        className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-[17px] leading-snug text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
      />
      {queryTrim.length > 0 ? (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange("")}
          className="shrink-0 rounded-full p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          aria-label="Очистить поле"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
