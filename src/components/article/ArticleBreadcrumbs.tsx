import Link from "next/link";
import { cn } from "@/lib/utils";

export function ArticleBreadcrumbs({
  title,
  homeHref,
  journalHref,
  className,
}: {
  title: string;
  homeHref: string;
  journalHref: string;
  className?: string;
}) {
  const resolvedHomeHref = journalHref.trim() === "/blog" ? "/" : homeHref;

  return (
    <nav aria-label="Хлебные крошки" className={cn("min-w-0 font-sans text-sm text-muted-foreground", className)}>
      <ol className="flex min-w-0 items-center gap-2 overflow-hidden">
        <li className="shrink-0">
          <Link href={resolvedHomeHref} className="transition-colors hover:text-foreground">Главная</Link>
        </li>
        <li aria-hidden className="shrink-0 opacity-50">→</li>
        <li className="shrink-0">
          <Link href={journalHref} className="transition-colors hover:text-foreground">Журнал</Link>
        </li>
        <li aria-hidden className="shrink-0 opacity-50">→</li>
        <li aria-current="page" className="min-w-0 truncate text-foreground" title={title}>{title}</li>
      </ol>
    </nav>
  );
}
