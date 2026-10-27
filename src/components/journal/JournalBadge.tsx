import { cn } from "@/lib/utils";

export type JournalBadgeVariant = "main" | "collection" | "news";

const VARIANT_CLASS: Record<JournalBadgeVariant, string> = {
  // «★ Главное» — стиль существующего бейджа над обложкой (белая плашка).
  main: "bg-white/90 text-foreground backdrop-blur-sm",
  // «Подборка»: светлый фон, тёмно-оранжевый текст (brand-ink на brand-soft — 5.2:1).
  collection: "bg-brand-soft text-brand-ink",
  // «Новость»: тёмный фон, белый текст (18:1).
  news: "bg-foreground text-background",
};

const LABEL: Record<JournalBadgeVariant, string> = {
  main: "★ Главное",
  collection: "Подборка",
  news: "Новость",
};

/**
 * Единый бейдж журнала (тип публикации / «Главное»). Тип и рубрика независимы:
 * у обычной статьи бейджа нет. `detail` — счётчик или время («10», «2 ч»).
 */
export function JournalBadge({
  variant,
  detail,
  className,
}: {
  variant: JournalBadgeVariant;
  detail?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold uppercase leading-none tracking-[.12em]",
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {LABEL[variant]}
      {detail ? <span aria-hidden> · </span> : null}
      {detail ? <span>{detail}</span> : null}
    </span>
  );
}

/** Бейдж по типу публикации; для ARTICLE — null (статья без бейджа). */
export function journalTypeBadgeVariant(
  publicationType: "ARTICLE" | "COLLECTION" | "BREAKING_NEWS",
): JournalBadgeVariant | null {
  if (publicationType === "COLLECTION") return "collection";
  if (publicationType === "BREAKING_NEWS") return "news";
  return null;
}
