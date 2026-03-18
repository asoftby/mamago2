import Link from "next/link";
import { Calendar, MapPin, Users, ArrowRight } from "lucide-react";

export interface FeaturedEvent {
  title: string;
  href: string;
  dateLabel: string;
  location?: string;
  ageLabel?: string;
  badge?: string;
  image?: string;
}

export interface ArticleFeaturedEventsBlockProps {
  title?: string;
  subtitle?: string;
  events: FeaturedEvent[];
  viewAllHref?: string;
  viewAllLabel?: string;
}

export function ArticleFeaturedEventsBlock({
  title = "Афиша на выходные",
  subtitle,
  events,
  viewAllHref,
  viewAllLabel = "Вся афиша",
}: ArticleFeaturedEventsBlockProps) {
  return (
    <div className="article-block not-prose font-sans my-10 md:my-12">
      {/* Header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-primary mb-1">
            Афиша
          </p>
          <h2
            className="text-xl md:text-2xl font-semibold text-foreground leading-snug"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-primary hover:opacity-75 transition-opacity shrink-0 ml-4"
          >
            {viewAllLabel}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {/* Events grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {events.map((event, i) => (
          <Link key={i} href={event.href} className="group block">
            <div className="rounded-xl bg-white border border-black/[0.06] shadow-sm hover:shadow-md transition-shadow duration-200 p-4 h-full flex flex-col gap-2.5">
              {/* Date pill */}
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/8 px-2.5 py-1 rounded-full self-start">
                <Calendar className="w-3 h-3" />
                {event.dateLabel}
              </div>

              {/* Title */}
              <p className="font-semibold text-sm leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2 flex-1">
                {event.title}
              </p>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[140px]">{event.location}</span>
                  </span>
                )}
                {event.ageLabel && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3 shrink-0" />
                    {event.ageLabel}
                  </span>
                )}
                {event.badge && (
                  <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs">
                    {event.badge}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Mobile view-all */}
      {viewAllHref && (
        <div className="mt-4 sm:hidden text-center">
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary"
          >
            {viewAllLabel}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
