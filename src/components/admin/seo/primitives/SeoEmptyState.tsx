import { cn } from "@/lib/utils";

export interface SeoEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Пустое состояние для списков и разделов SEO.
 */
export function SeoEmptyState({
  icon,
  title,
  description,
  action,
  footer,
  className,
}: SeoEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-6 py-16 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm">
          {icon}
        </div>
      ) : null}
      <h3
        className={cn(
          "text-lg font-semibold text-gray-900",
          icon ? "mt-5" : undefined,
        )}
      >
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
      {footer ? (
        <p className="mt-3 text-xs text-gray-400">{footer}</p>
      ) : null}
    </div>
  );
}
