import Image from "next/image";
import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import { ArticleEmbeddedCardShell } from "./ArticleEmbeddedCardShell";

export interface ShowcasePlace {
  id: string;
  title: string;
  href: string;
  image?: string;
  category?: string;
  location?: string;
}

export interface ArticlePlacesShowcaseBlockProps {
  title?: string;
  subtitle?: string;
  places: ShowcasePlace[];
  viewAllHref?: string;
  viewAllLabel?: string;
}

export function ArticlePlacesShowcaseBlock({
  title = "Подборка мест",
  subtitle,
  places,
  viewAllHref,
  viewAllLabel = "Смотреть все",
}: ArticlePlacesShowcaseBlockProps) {
  const [featured, ...rest] = places;

  return (
    <div className="article-block not-prose font-sans my-10 md:my-14">
      {/* Section header */}
      <div className="mb-5 md:mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
          Подборка
        </p>
        <h2 className="text-xl md:text-2xl font-semibold text-foreground leading-snug">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {/* Featured — same card shell language, larger image */}
        {featured && (
          <Link href={featured.href} className="group block">
            <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-black/[0.06] hover:shadow-md transition-shadow duration-200">
              <div className="relative aspect-[16/9] bg-muted overflow-hidden">
                {featured.image ? (
                  <Image
                    src={featured.image}
                    alt={featured.title}
                    fill
                    className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-100" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                  {featured.category && (
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60 block mb-1">
                      {featured.category}
                    </span>
                  )}
                  <h3 className="!font-sans font-semibold text-base text-white leading-snug group-hover:opacity-90 transition-opacity">
                    {featured.title}
                  </h3>
                  {featured.location && (
                    <p className="flex items-center gap-1 text-xs text-white/65 mt-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {featured.location}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Rest — compact rows, same surface language */}
        {rest.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {rest.map((place) => (
              <Link key={place.id} href={place.href} className="group block">
                <div className="rounded-xl bg-white border border-black/[0.06] shadow-sm hover:shadow-md transition-shadow duration-200 flex items-center gap-3 p-3">
                  <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-muted">
                    {place.image ? (
                      <Image
                        src={place.image}
                        alt={place.title}
                        fill
                        className="object-cover group-hover:scale-[1.06] transition-transform duration-200"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {place.category && (
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5 truncate">
                        {place.category}
                      </p>
                    )}
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
                      {place.title}
                    </p>
                    {place.location && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{place.location}</span>
                      </p>
                    )}
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {viewAllHref && (
        <div className="mt-5 text-center">
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-75 transition-opacity"
          >
            {viewAllLabel}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
