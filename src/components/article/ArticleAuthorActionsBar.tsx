import { ArticleDetailActions } from "@/components/article/ArticleDetailActions";
import { cn } from "@/lib/utils";

export type ArticleAuthor = {
  displayName: string | null;
  avatarUrl: string | null;
} | null;

export function ArticleAuthorActionsBar({
  author,
  articleId,
  title,
  href,
  coverImageUrl,
  source,
  citySlug,
  className,
}: {
  author: ArticleAuthor;
  articleId?: string;
  title: string;
  href?: string;
  coverImageUrl?: string | null;
  source: string;
  citySlug?: string | null;
  className?: string;
}) {
  const authorName = author?.displayName?.trim() || "Редакция mamaGo";
  const authorInitial = authorName.charAt(0).toUpperCase();

  return (
    <div className={cn("flex flex-wrap items-center gap-4 border-t border-border/60 pt-4", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {author?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={author.avatarUrl} alt={authorName} className="h-9 w-9 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-700">
            {authorInitial}
          </span>
        )}
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">{authorName}</span>
      </div>
      {articleId && href ? (
        <ArticleDetailActions
          articleId={articleId}
          title={title}
          href={href}
          coverImageUrl={coverImageUrl}
          source={source}
          citySlug={citySlug}
          className="ml-auto flex-wrap"
        />
      ) : null}
    </div>
  );
}
