"use client";

import { useRef, useEffect } from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchInput({
  value,
  onChange,
  loading,
  open,
}: {
  value: string;
  onChange: (v: string) => void;
  loading: boolean;
  open: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      ref.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm",
        "transition-[box-shadow,border-color] focus-within:border-neutral-300 focus-within:shadow-md",
      )}
    >
      <Search className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden />
      <input
        ref={ref}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Поиск событий, мест, маршрутов"
        className="min-w-0 flex-1 bg-transparent text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {value.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-md p-0.5 text-neutral-400",
            "transition-colors hover:text-neutral-800",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20",
          )}
          aria-label="Очистить поле"
        >
          <X className="h-[18px] w-[18px] shrink-0" strokeWidth={2.5} aria-hidden />
        </button>
      ) : null}
      {loading ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-neutral-400" aria-label="Загрузка" />
      ) : null}
    </div>
  );
}
