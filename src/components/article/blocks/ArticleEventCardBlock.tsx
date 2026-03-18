import { Calendar, MapPin, Users } from "lucide-react";
import { ArticleEmbeddedCardShell } from "./ArticleEmbeddedCardShell";
import { ARTICLE_CARD_PRIMARY_CTA } from "./articleCardCta";

export interface ArticleEventCardBlockProps {
  title: string;
  href: string;
  image?: string;
  dateLabel: string;
  location?: string;
  ageLabel?: string;
  badge?: string;
}

export function ArticleEventCardBlock({
  title,
  href,
  image,
  dateLabel,
  location,
  ageLabel,
  badge,
}: ArticleEventCardBlockProps) {
  return (
    <ArticleEmbeddedCardShell
      href={href}
      image={image}
      imageAlt={title}
      placeholderGradient="from-orange-100 to-rose-100"
      placeholderIcon={<Calendar className="w-9 h-9 text-orange-300" />}
      imagePill={
        badge ? (
          <span className="bg-white/90 backdrop-blur-sm text-xs font-medium px-2.5 py-1 rounded-full text-foreground shadow-sm">
            {badge}
          </span>
        ) : undefined
      }
      typeLabel="Событие"
      title={title}
      metaItems={[
        <span key="date" className="inline-flex items-center gap-1 text-primary font-medium">
          <Calendar className="w-3 h-3" />
          {dateLabel}
        </span>,
        location && (
          <span key="loc" className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />
            {location}
          </span>
        ),
        ageLabel && (
          <span key="age" className="inline-flex items-center gap-1">
            <Users className="w-3 h-3 shrink-0" />
            {ageLabel}
          </span>
        ),
      ]}
      primaryCta={ARTICLE_CARD_PRIMARY_CTA.event}
    />
  );
}
