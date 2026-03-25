import { cn } from "@/lib/utils";

export interface SeoPageHeaderProps {
  title: string;
  subtitle?: string;
  /** Кнопки или вторичные действия справа */
  actions?: React.ReactNode;
  /** Иконка или маркер слева от заголовка */
  leading?: React.ReactNode;
  className?: string;
}

/**
 * Единый заголовок разделов SEO Control Center.
 */
export function SeoPageHeader({
  title,
  subtitle,
  actions,
  leading,
  className,
}: SeoPageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-gray-100 pb-6 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex gap-4">
        {leading ? (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm">
            {leading}
          </div>
        ) : null}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-[26px]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-600">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2 pt-1">{actions}</div>
      ) : null}
    </header>
  );
}
