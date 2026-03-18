import { MapPin } from "lucide-react";
import { ArticleEmbeddedCardShell } from "./ArticleEmbeddedCardShell";
import { ARTICLE_CARD_PRIMARY_CTA } from "./articleCardCta";

export interface ArticlePlaceCardBlockProps {
  title: string;
  href: string;
  image?: string;
  category?: string;
  location?: string;
  description?: string;
}

export function ArticlePlaceCardBlock({
  title,
  href,
  image,
  category,
  location,
  description,
}: ArticlePlaceCardBlockProps) {
  return (
    <ArticleEmbeddedCardShell
      href={href}
      image={image}
      imageAlt={title}
      placeholderGradient="from-emerald-50 to-teal-100"
      placeholderIcon={<MapPin className="w-9 h-9 text-emerald-300" />}
      typeLabel="Место"
      title={title}
      metaItems={[
        category && <span key="cat">{category}</span>,
        location && (
          <span key="loc" className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />
            {location}
          </span>
        ),
      ]}
      description={description}
      primaryCta={ARTICLE_CARD_PRIMARY_CTA.place}
    />
  );
}
