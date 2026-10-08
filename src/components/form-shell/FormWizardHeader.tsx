"use client";

import { cn } from "@/lib/utils";

const SHELL_MAX = "mx-auto w-full max-w-5xl";

interface FormWizardHeaderProps {
  title: React.ReactNode;
  /** e.g. "Шаг 3 из 9 · Локация" — built by parent from labels + step meta */
  subtitle?: React.ReactNode;
  /** Draft time, badges, etc. */
  trailing?: React.ReactNode;
  /** Extra row under title (completion widget, banners) */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Top sticky header: title + optional subtitle — no navigation actions
 * (those live in FormStickyActionBar).
 */
export function FormWizardHeader({
  title,
  subtitle,
  trailing,
  children,
  className,
}: FormWizardHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className
      )}
    >
      <div className={`${SHELL_MAX} px-4 py-3 sm:px-6 sm:py-4 lg:px-8`}>
        <div className="mb-2 flex flex-col gap-2 sm:mb-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight tracking-tight sm:text-2xl">{title}</h1>
            {subtitle != null && (
              <p className="mt-1 text-sm leading-snug text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {trailing != null ? (
            <div className="shrink-0 text-left text-xs text-muted-foreground sm:pt-1 sm:text-right">
              {trailing}
            </div>
          ) : null}
        </div>
        {children}
      </div>
    </header>
  );
}

export const formShellContentWidthClass = SHELL_MAX;
