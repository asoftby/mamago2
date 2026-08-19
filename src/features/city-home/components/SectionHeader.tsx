import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type SectionHeaderProps = {
  title: string;
  subtitle?: string | null;
  /** Текст ссылки справа (например «Смотреть все»); для `actionIconButton` используется как `aria-label` */
  actionLabel?: string | null;
  actionHref?: string | null;
  /** Круглая кнопка со стрелкой вместо текстовой ссылки (как в Breaking News) */
  actionIconButton?: boolean;
  /**
   * Текстовая ссылка справа от заголовка (шрифт как у «2.0 beta» в логотипе).
   * Не меняет поведение `actionIconButton` в остальных секциях.
   */
  actionInlineText?: boolean;
  /** Доп. классы для текстовой action-ссылки в заголовке (например `lg:hidden`) */
  headerActionClassName?: string;
  className?: string;
};

/** Ссылка «[все …]» в стиле подписи «2.0 beta» (font-mono). */
export function CityHomeAllLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 shrink-0 items-center max-w-full font-mono font-normal lowercase",
        "text-[12px] md:text-[13px] leading-none text-primary whitespace-nowrap",
        "rounded-sm transition-opacity hover:opacity-70",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      {label}
    </Link>
  );
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  actionHref,
  actionIconButton = false,
  actionInlineText = false,
  headerActionClassName,
  className,
}: SectionHeaderProps) {
  const showAction = Boolean(actionHref && actionLabel);
  const useInlineText = showAction && actionInlineText;
  const useIconButton = showAction && actionIconButton && !useInlineText;
  const inlineTitleAndAction = (useIconButton || useInlineText) && !subtitle;

  const actionLink = showAction ? (
    useInlineText ? (
      <CityHomeAllLink
        href={actionHref!}
        label={actionLabel!}
        className={headerActionClassName}
      />
    ) : (
      <Link
        href={actionHref!}
        className={cn(
          useIconButton &&
            cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              "bg-primary/10 text-primary transition-colors hover:bg-primary/15",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            ),
          !useIconButton &&
            "inline-flex items-center gap-0.5 text-sm font-medium text-primary shrink-0 hover:opacity-90 transition-opacity",
          headerActionClassName,
        )}
        aria-label={useIconButton ? actionLabel! : undefined}
      >
        {useIconButton ? (
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        ) : (
          <>
            {actionLabel}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </>
        )}
      </Link>
    )
  ) : null;

  if (inlineTitleAndAction) {
    return (
      <div
        className={cn(
          useInlineText
            ? "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-1 mb-4"
            : "flex flex-wrap items-center gap-x-2.5 gap-y-2 px-1 mb-4",
          className,
        )}
      >
        <h2 className="min-w-0 text-neutral-900 leading-tight" style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 30, letterSpacing: "-1px" }}>
          {title}
        </h2>
        {actionLink}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4 px-1 mb-4",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h2 className="text-neutral-900 leading-tight" style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 30, letterSpacing: "-1px" }}>
          {title}
        </h2>
        {subtitle ? (
          <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-[0.2em]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actionLink}
    </div>
  );
}
