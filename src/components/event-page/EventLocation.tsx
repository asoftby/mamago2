"use client";

import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EventPageVenue } from "@/lib/event/eventPageTypes";

interface EventLocationProps {
  venue: EventPageVenue;
}

/**
 * Блок "Где проходит" - локация события.
 * Название места, описание, адрес, карта.
 */
export function EventLocation({ venue }: EventLocationProps) {
  return (
    <section className="border-t border-border/40 py-10">
      <h2 className="mb-8 font-headline text-2xl font-bold text-foreground">
        Где проходит
      </h2>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Левая часть: информация */}
        <div className="space-y-6">
          {/* Название места */}
          <div>
            <h3 className="text-xl font-semibold text-foreground">
              {venue.name}
            </h3>
            {venue.landmark && (
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                {venue.landmark}
              </p>
            )}
          </div>

          {/* Адрес */}
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              {venue.address && (
                <p className="text-[15px] text-foreground">{venue.address}</p>
              )}
              {venue.district && (
                <p className="text-[13px] text-muted-foreground">
                  Район: {venue.district}
                </p>
              )}
              {venue.metro && (
                <p className="text-[13px] text-muted-foreground">
                  Метро: {venue.metro}
                </p>
              )}
            </div>
          </div>

          {/* Кнопка маршрута */}
          {venue.routeUrl && (
            <Button
              asChild
              variant="outline"
              className="gap-2"
            >
              <a
                href={venue.routeUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Navigation className="h-4 w-4" />
                Построить маршрут
              </a>
            </Button>
          )}
        </div>

        {/* Правая часть: карта */}
        {venue.mapUrl && (
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/40 bg-neutral-100 lg:aspect-square">
            <img
              src={venue.mapUrl}
              alt={`Карта: ${venue.name}`}
              className="h-full w-full object-cover"
            />
            {/* Маркер на карте */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg ring-4 ring-white/30">
                <MapPin className="h-6 w-6 fill-white text-white" />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
