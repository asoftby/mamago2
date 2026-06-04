import { ReactNode } from "react";

interface ArticleContentProps {
  children: ReactNode;
  className?: string;
}

/**
 * ArticleContent — reading wrapper with serif article typography.
 * Apply this around long-form article body text.
 * Product blocks (cards, CTAs) placed inside will inherit sans via their own className.
 */
export function ArticleContent({ children, className }: ArticleContentProps) {
  return (
    <div
      className={[
        "article-body",
        "font-serif",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
