import { cn } from "@/lib/utils";

/** Оболочка страницы Discovery / Taxonomy (как Event Categories). */
export const DISCOVERY_PAGE_SHELL = "p-6 md:p-4 space-y-6";

export const DISCOVERY_TABLE_WRAP = "border border-gray-200 rounded-lg overflow-hidden bg-white";

export const DISCOVERY_TABLE = "w-full text-sm";

export const discoveryTh = (extra?: string) =>
  cn("px-4 py-3 text-left font-medium text-gray-700", extra);

export const discoveryTd = (extra?: string) => cn("px-4 py-2.5", extra);

export const DISCOVERY_NATIVE_SELECT =
  "w-full h-10 border border-gray-300 rounded-md px-3 text-sm bg-white";

/** Строка таблицы: клик + hover + фокус. */
export function discoveryTableRowClass(isChildRow?: boolean) {
  return cn(
    "group",
    isChildRow ? "bg-slate-50/80" : "bg-white",
    "cursor-pointer transition-colors hover:bg-slate-100/90",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-inset",
  );
}
