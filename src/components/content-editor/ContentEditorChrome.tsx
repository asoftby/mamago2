"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ContentEditorSurface } from "@/lib/content-editor/types";
import { cn } from "@/lib/utils";

interface ContentEditorChromeProps {
  title: string;
  backHref: string;
  surface: ContentEditorSurface;
  headerAction?: React.ReactNode;
  /** Extra class on the outer wrapper */
  className?: string;
  children: React.ReactNode;
}

const surfaceLabel: Record<ContentEditorSurface, string> = {
  business: "Кабинет",
  admin: "Модерация",
};

export function ContentEditorChrome({
  title,
  backHref,
  surface,
  headerAction,
  className,
  children,
}: ContentEditorChromeProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[ContentEditorChrome] mounted", { title, backHref, surface });
    }
    return () => {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[ContentEditorChrome] unmounted", { title, backHref, surface });
      }
    };
  }, [backHref, surface, title]);

  return (
    <div className={cn("min-h-0 flex flex-1 flex-col", className)}>
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Назад
            </Link>
            <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">{title}</h1>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {surfaceLabel[surface]}
                </span>
              </div>
            </div>
          </div>
          {headerAction ? <div className="hidden shrink-0 md:block">{headerAction}</div> : null}
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
