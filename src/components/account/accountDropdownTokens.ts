import { cn } from "@/lib/utils";

/** Единая ширина выпадающего меню аккаунта (popover + внутренний контент sheet) */
export const ACCOUNT_DROPDOWN_WIDTH_CLASS = "w-full sm:w-[min(100vw-2rem,280px)]";

export const accountDropdownRowBase =
  "flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-gray-200 focus-visible:ring-offset-2 [&_svg]:shrink-0";

export const accountDropdownRowDefault = cn(
  accountDropdownRowBase,
  "text-foreground hover:bg-gray-50 [&_svg]:text-gray-500",
);

export const accountDropdownRowAccent = cn(
  accountDropdownRowBase,
  "font-medium text-primary hover:bg-primary/5 [&_svg]:text-primary",
);

/** Пункт текущей страницы: оранжевый текст; hover/focus у остальных — только лёгкий фон. */
export const accountDropdownRowActive = cn(
  accountDropdownRowBase,
  "bg-primary/5 font-medium text-primary hover:bg-primary/10 [&_svg]:text-primary",
);

/** `/me/ideas` и `/me/ideas/...` совпадают, `/me/ideas-x` и `/me` для `/me/ideas` — нет. */
export function isAccountRowActive(
  pathname: string | null,
  row: { activeHref?: string; activeExact?: boolean },
): boolean {
  if (!pathname || !row.activeHref) return false;
  if (pathname === row.activeHref) return true;
  return !row.activeExact && pathname.startsWith(row.activeHref + "/");
}

export const accountDropdownIconClass = "h-4 w-4";
