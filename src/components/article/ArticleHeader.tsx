import Image from "next/image";

interface ArticleHeaderProps {
  title: string;
  subtitle?: string;
  category?: string;
  readTime?: number; // minutes
  publishedAt?: string | Date;
  heroImage?: {
    src: string;
    alt: string;
    blurDataURL?: string;
  };
}

export function ArticleHeader({
  title,
  subtitle,
  category,
  readTime,
  publishedAt,
  heroImage,
}: ArticleHeaderProps) {
  const formattedDate = publishedAt
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(publishedAt))
    : null;

  return (
    <header className="mb-10 md:mb-14">
      {/* Category + meta */}
      {(category || formattedDate || readTime) && (
        <div className="flex flex-wrap items-center gap-2 mb-5 text-sm text-muted-foreground font-sans">
          {category && (
            <span className="text-primary font-medium uppercase tracking-wide text-xs">
              {category}
            </span>
          )}
          {category && (formattedDate || readTime) && (
            <span className="text-border">·</span>
          )}
          {formattedDate && <span>{formattedDate}</span>}
          {readTime && (
            <>
              <span className="text-border">·</span>
              <span>{readTime} мин чтения</span>
            </>
          )}
        </div>
      )}

      {/* Title */}
      <h1
        className="font-serif text-3xl md:text-4xl lg:text-5xl leading-tight tracking-tight text-foreground mb-4"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {title}
      </h1>

      {/* Subtitle / dek */}
      {subtitle && (
        <p
          className="text-lg md:text-xl text-muted-foreground leading-relaxed font-sans font-normal"
        >
          {subtitle}
        </p>
      )}

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
