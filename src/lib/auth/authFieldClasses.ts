import { cn } from "@/lib/utils";

/** Единые поля ввода для auth и My Plan unauth flow */
export const AUTH_INPUT_CLASS =
  "w-full h-12 px-4 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#EF8759] transition-shadow placeholder:text-neutral-400";

export const AUTH_PRIMARY_BUTTON_CLASS =
  "w-full h-12 rounded-xl bg-[#EF8759] hover:bg-[#e07040] cursor-pointer touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors shadow-sm";

export const AUTH_SELECT_TRIGGER_CLASS = cn(
  "h-12 w-full min-w-0 rounded-xl border border-neutral-200 bg-white px-4 text-sm shadow-none",
  "focus:outline-none focus:ring-2 focus:ring-[#EF8759] focus-visible:ring-[#EF8759]",
  "[&>span]:line-clamp-1",
);
