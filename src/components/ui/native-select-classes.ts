import { cn } from "@/lib/utils";

const nativeSelectBase = cn(
  "box-border h-[2.75rem] w-full min-w-0 rounded-md border border-input bg-white pl-3 pr-14 text-sm shadow-xs",
  "outline-none transition-[color,box-shadow]",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

/** Native `<select>` with top margin (under a `Label` without `mt` on the control) */
export const nativeSelectFieldClassName = cn("mt-2", nativeSelectBase);

/** Same height, no `mt-2` — use when the field sits in its own grid row */
export const nativeSelectFieldClassNameFlush = nativeSelectBase;
