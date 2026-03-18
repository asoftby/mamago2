import { MapPin, Clock, Users, Navigation } from "lucide-react";
import { ArticleEmbeddedCardShell } from "./ArticleEmbeddedCardShell";
import { ARTICLE_CARD_PRIMARY_CTA } from "./articleCardCta";

export interface ArticleRouteCardBlockProps {
  title: string;
  href: string;
  image?: string;
  city?: string;
  stopCount?: number;
  ageLabel?: string;
  duration?: string;
  description?: string;
}

export function ArticleRouteCardBlock({
  title,
  href,
  image,
  city,
  stopCount,
  ageLabel,
  duration,
  description,
}: ArticleRouteCardBlockProps) {
  const stopsLabel =
    stopCount !== undefined
      ? `${stopCount} ${stopCount === 1 ? "точка" : stopCount < 5 ? "точки" : "точек"}`
      : undefined;

  return (
    <ArticleEmbeddedCardShell
      href={href}
      image={image}
      imageAlt={title}
      placeholderGradient="from-sky-100 via-blue-50 to-indigo-100"
      placeholderIcon={<Navigation className="w-9 h-9 text-blue-300" />}
      imagePill={
        <span className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-xs font-medium px-2.5 py-1 rounded-full text-foreground shadow-sm">
          <Navigation className="w-3 h-3 text-primary" />
          Маршрут
        </span>
      }
      typeLabel="Маршрут"
      title={title}
      metaItems={[
        city && (
          <span key="city" className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />
            {city}
          </span>
        ),
        stopsLabel && <span key="stops">{stopsLabel}</span>,
        ageLabel && (
          <span key="age" className="inline-flex items-center gap-1">
            <Users className="w-3 h-3 shrink-0" />
            {ageLabel}
          </span>
        ),
        duration && (
          <span key="dur" className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3 shrink-0" />
            {duration}
          </span>
        ),
      ]}
      description={description}
      primaryCta={ARTICLE_CARD_PRIMARY_CTA.route}
    />
  );
}
