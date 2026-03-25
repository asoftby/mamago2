import { cn } from "@/lib/utils";

export interface SeoTableToolbarProps {
  /** Слева: поиск, фильтры */
  start?: React.ReactNode;
  /** Справа: действия */
  end?: React.ReactNode;
  className?: string;
}

/**
 * Панель над таблицами SEO (фильтры + действия).
 */
export function SeoTableToolbar({ start, end, className }: SeoTableToolbarProps) {
  if (!start && !end) return null;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1">{start}</div>
      {end ? <div className="flex shrink-0 flex-wrap gap-2">{end}</div> : null}
    </div>
  );
}
