import { Tag } from "lucide-react";
import { ArticleEmbeddedCardShell } from "./ArticleEmbeddedCardShell";
import { ARTICLE_CARD_PRIMARY_CTA } from "./articleCardCta";

export interface ArticleOfferCardBlockProps {
  title: string;
  href: string;
  image?: string;
  highlight?: string;
  badge?: string;
  badgeVariant?: "default" | "promo" | "new";
}

const badgeColors: Record<string, string> = {
  default: "bg-muted text-muted-foreground",
  promo: "bg-rose-50 text-rose-600",
  new: "bg-emerald-50 text-emerald-600",
};

export function ArticleOfferCardBlock({
  title,
  href,
  image,
  highlight,
  badge,
  badgeVariant = "default",
}: ArticleOfferCardBlockProps) {
  return (
    <ArticleEmbeddedCardShell
      href={href}
      image={image}
      imageAlt={title}
      placeholderGradient="from-violet-50 to-purple-100"
      placeholderIcon={<Tag className="w-9 h-9 text-violet-300" />}
      imagePill={
        badge ? (
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full shadow-sm ${badgeColors[badgeVariant]}`}>
            {badge}
          </span>
        ) : undefined
      }
      typeLabel="Предложение"
      title={title}
      description={highlight}
      primaryCta={ARTICLE_CARD_PRIMARY_CTA.offer}
    />
  );
}
