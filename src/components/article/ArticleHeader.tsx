import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Типографика лида: публичная шапка и редактор intro должны совпадать. */
export const ARTICLE_DEK_CLASSNAME =
  "text-[22px] text-muted-foreground leading-relaxed font-serif font-normal [&_em]:italic [&_i]:italic [&_strong]:font-semibold [&_b]:font-semibold [&_p]:m-0 [&_p+p]:mt-3 [&_br]:block [&_br]:mb-[0.65em]";

interface ArticleHeaderProps {
  title: string;
  subtitle?: string;
  /** HTML лида из блока intro (bold/italic/br) — приоритетнее plain subtitle */
  subtitleHtml?: string;
  /** Корневой раздел журнала, напр. «Обзоры и статьи» */
  journalLabel?: string;
  journalHref?: string;
  /** Подраздел / категория, напр. «Подборки» → рендерится как [подборки] */
  category?: string;
  /** Ссылка для [категории] */
  categoryHref?: string;
  readTime?: number; // minutes
  publishedAt?: string | Date;
  editHref?: string;
  heroImage?: {
    src: string;
    alt: string;
    blurDataURL?: string;
  };
}

export function ArticleHeader({
  title,
  subtitle,
  subtitleHtml,
  journalLabel = "Обзоры и статьи",
  journalHref,
  category,
  categoryHref,
  readTime,
  publishedAt,
  editHref,
  heroImage,
}: ArticleHeaderProps) {
  const formattedDate = (() => {
    if (publishedAt == null || publishedAt === "") return null;
    const d = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  })();

  const showDek = Boolean(subtitleHtml?.trim() || subtitle?.trim());
  const categoryLabel = category?.trim().toLocaleLowerCase("ru-RU") || null;
  const showMeta =
    Boolean(journalHref || categoryLabel || formattedDate || readTime || editHref);

  const journalClassName =
    "inline-flex items-center text-primary font-medium uppercase tracking-wide text-xs leading-none transition-colors hover:text-primary/80";
  const categoryClassName =
    "inline-flex items-center font-mono font-normal lowercase text-[12px] md:text-[13px] leading-none whitespace-nowrap transition-opacity hover:opacity-70";
  const metaPlainClassName = "inline-flex items-center text-sm leading-none";

  const categoryNode = categoryLabel ? (
    <>
      <span className="text-primary">[</span>
      <span className="text-primary">{categoryLabel}</span>
      <span className="text-primary">]</span>
    </>
  ) : null;

  return (
    <header className="mb-10 md:mb-14">
      {/* Journal · [section] · date · read time · edit */}
      {showMeta ? (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 mb-5 text-sm text-muted-foreground font-sans">
          {journalHref ? (
            <Link href={journalHref} className={journalClassName}>
              {journalLabel}
            </Link>
          ) : (
            <span className={journalClassName}>{journalLabel}</span>
          )}
          {categoryNode ? (
            categoryHref ? (
              <Link href={categoryHref} className={categoryClassName}>
                {categoryNode}
              </Link>
            ) : (
              <span className={categoryClassName}>{categoryNode}</span>
            )
          ) : null}
          {formattedDate ? (
            <span className={metaPlainClassName}>{formattedDate}</span>
          ) : null}
          {readTime ? (
            <span className={metaPlainClassName}>{readTime} мин чтения</span>
          ) : null}
          {editHref ? (
            <Link
              href={editHref}
              className={cn(
                metaPlainClassName,
                "font-medium text-foreground underline underline-offset-4 decoration-foreground/45 transition-colors hover:text-primary hover:decoration-primary",
              )}
            >
              Редактировать
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* Title */}
      <h1
        className="font-sans font-bold text-3xl md:text-4xl lg:text-5xl leading-tight tracking-tight text-foreground mb-4"
      >
        {title}
      </h1>

      {/* Subtitle / dek */}
      {showDek ? (
        subtitleHtml?.trim() ? (
          <div
            className={cn(ARTICLE_DEK_CLASSNAME)}
            dangerouslySetInnerHTML={{ __html: subtitleHtml }}
          />
        ) : (
          <p className={cn(ARTICLE_DEK_CLASSNAME)}>{subtitle}</p>
        )
      ) : null}

      {/* Hero image */}
      {heroImage && (
        <div className="mt-8 rounded-2xl overflow-hidden aspect-[16/9] relative bg-muted">
          <Image
            src={heroImage.src}
            alt={heroImage.alt}
            fill
            className="object-cover"
            placeholder={heroImage.blurDataURL ? "blur" : "empty"}
            blurDataURL={heroImage.blurDataURL}
            priority
          />
        </div>
      )}
    </header>
  );
}
