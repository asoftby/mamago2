"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventPageBreadcrumb } from "@/lib/event/eventPageTypes";

export function EventBreadcrumbs({
  items,
  className,
}: {
  items: EventPageBreadcrumb[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <nav
      aria-label="Хлебные крошки"
      className={cn("flex flex-wrap items-center gap-1.5 text-sm", className)}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.href}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && (
              <ChevronRight
                className="size-3.5 shrink-0 text-muted-foreground/70"
                aria-hidden
              />
            )}
            {isLast ? (
              <span className="line-clamp-1 text-muted-foreground">{item.label}</span>
            ) : (
              <Link
                href={item.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
