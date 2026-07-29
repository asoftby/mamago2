import { parseArticleEmbed } from "@/lib/article/articleEmbedSanitize";

const EMBED_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

export function ArticleEmbedBlock({
  value,
  caption,
  compact = false,
}: {
  value: unknown;
  caption?: string | null;
  compact?: boolean;
}) {
  const parsed = parseArticleEmbed(value);
  if (!parsed) return null;
  const title = caption?.trim() || (parsed.provider === "youtube" ? "Видео YouTube" : "Встроенный материал");

  return (
    <figure className={compact ? "not-prose max-w-full" : "not-prose my-8 max-w-[720px] md:my-10"}>
      {parsed.provider === "youtube" ? (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/15">
          <div className="relative aspect-video w-full">
            <iframe
              className="absolute inset-0 h-full w-full border-0"
              src={parsed.embedUrl}
              title={title}
              loading="lazy"
              allow={EMBED_ALLOW}
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      ) : parsed.provider === "instagram" ? (
        <div className="mx-auto w-full max-w-[540px] overflow-hidden rounded-2xl border border-border/60 bg-muted/15">
          <iframe
            className="block min-h-[620px] w-full border-0"
            src={parsed.url}
            title={title}
            loading="lazy"
            allow={EMBED_ALLOW}
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <a
          href={parsed.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-sm font-medium text-primary underline underline-offset-4"
        >
          Открыть материал
        </a>
      )}
      {caption?.trim() ? (
        <figcaption className="mt-3 px-1 text-center text-sm text-muted-foreground">{caption.trim()}</figcaption>
      ) : null}
    </figure>
  );
}
