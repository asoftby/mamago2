import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type SectionHeaderProps = {
  title: string;
  subtitle?: string | null;
  /** Текст ссылки справа (например «Смотреть все») */
  actionLabel?: string | null;
  actionHref?: string | null;
  className?: string;
};

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  actionHref,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4 px-1 mb-3",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h2 className="text-lg font-semibold text-neutral-900 leading-tight tracking-tight">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-[0.2em]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-0.5 text-sm font-medium text-primary shrink-0 hover:opacity-90 transition-opacity"
        >
          {actionLabel}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
