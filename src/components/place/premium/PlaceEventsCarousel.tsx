"use client";

import { ChevronLeft, ChevronRight, Calendar, MapPin } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRef } from "react";

interface Event {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string;
  startDate: string;
  endDate?: string;
  location?: string;
  price?: number;
  category?: string;
}

interface PlaceEventsCarouselProps {
  events: Event[];
  placeId: string;
}

export function PlaceEventsCarousel({
  events,
  placeId,
}: PlaceEventsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!events || events.length === 0) {
    return null;
  }

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 320;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <section className="pt-8 border-t border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Предстоящие события
          </h2>
          <p className="text-gray-600 mt-1">
            Мероприятия, которые проходят в этом месте
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => scroll("left")}
            className="rounded-full"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => scroll("right")}
            className="rounded-full"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-4"
      >
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/events/${event.slug}`}
            className="flex-shrink-0 w-[300px] group"
          >
            <Card className="overflow-hidden border-gray-200 hover:shadow-lg transition-shadow">
              {/* Event image */}
              <div className="relative h-48 bg-gray-100">
                {event.imageUrl ? (
                  <Image
                    src={event.imageUrl}
                    alt={event.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
                    <Calendar className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                {event.category && (
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium text-gray-700">
                    {event.category}
                  </div>
                )}
              </div>

              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {event.title}
                </h3>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{formatDate(event.startDate)}</span>
                  </div>

                  {event.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  )}
                </div>

                {event.price !== undefined && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <span className="text-lg font-bold text-gray-900">
                      {event.price === 0
                        ? "Бесплатно"
                        : `от ${event.price} ₽`}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {events.length > 3 && (
        <div className="mt-6 text-center">
          <Button asChild variant="outline" size="lg">
            <Link href={`/places/${placeId}/events`}>
              Посмотреть все события ({events.length})
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
