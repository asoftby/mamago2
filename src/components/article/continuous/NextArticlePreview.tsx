import Link from "next/link";

type Props = {
  href: string;
  title: string;
  excerpt?: string | null;
  heroUrl?: string | null;
  heroAlt?: string | null;
  readTimeMinutes?: number;
  sectionName: string;
  onNavigate?: () => void;
};

/**
 * Preview следующей статьи + crawlable `<a href>`.
 */
export function NextArticlePreview({
  href,
  title,
  excerpt,
  heroUrl,
  heroAlt,
  readTimeMinutes,
  sectionName,
  onNavigate,
}: Props) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="group not-prose block rounded-xl border border-border/70 bg-muted/20 p-4 sm:p-5 transition-colors hover:border-border hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex gap-4 sm:gap-5">
        {heroUrl ? (
          <div className="relative h-20 w-28 sm:h-24 sm:w-36 shrink-0 overflow-hidden rounded-lg bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- произвольные CDN URL обложек журнала */}
            <img
              src={heroUrl}
              alt={heroAlt || title}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : (
          <div
            className="h-20 w-28 sm:h-24 sm:w-36 shrink-0 rounded-lg bg-muted/60 border border-dashed border-border/60"
            aria-hidden
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-primary mb-1.5">
            {sectionName}
          </p>
          <p className="font-serif text-lg sm:text-xl font-semibold text-foreground leading-snug group-hover:underline underline-offset-2 decoration-foreground/25">
            {title}
          </p>
          {excerpt?.trim() ? (
            <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {excerpt.trim()}
            </p>
          ) : null}
          {typeof readTimeMinutes === "number" ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {readTimeMinutes} мин чтения
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
