"use client";

import { ArrowRight, Heart, Calendar, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { isAppMediaUrl } from "@/lib/media/isAppMediaUrl";

interface Event {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string;
  startDate: string;
  price?: number;
  category?: string;
}

interface PlaceEventsSectionProps {
  events: Event[];
  placeId: string;
}

export function PlaceEventsSection({ events, placeId }: PlaceEventsSectionProps) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Разовые занятия</h2>
        <Link
          href={`/places/${placeId}#events`}
          className="flex items-center gap-1 text-sm font-medium text-[#EF8759] transition hover:text-[#EF8759]/80"
        >
          Все занятия
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

function EventCard({ event }: { event: Event }) {
  const eventDate = new Date(event.startDate);
  const formattedDate = format(eventDate, "d MMMM", { locale: ru });
  const formattedTime = format(eventDate, "HH:mm");

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group relative flex w-[280px] flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:shadow-lg"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        {event.imageUrl ? (
          <Image
            src={event.imageUrl}
            alt={event.title}
            fill
            sizes="280px"
            unoptimized={isAppMediaUrl(event.imageUrl)}
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <Calendar className="h-12 w-12 text-gray-400" />
          </div>
        )}

        {/* Price Badge */}
        {event.price && (
          <div className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-sm font-semibold text-gray-900 shadow-md">
            от {event.price} BYN
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            // TODO: Implement save functionality
          }}
          className="absolute right-3 top-3 rounded-full bg-white/90 p-2 backdrop-blur-sm transition hover:bg-white"
          aria-label="Сохранить"
        >
          <Heart className="h-4 w-4 text-gray-700" />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-base font-semibold text-gray-900 group-hover:text-[#EF8759]">
          {event.title}
        </h3>

        <div className="mt-auto space-y-1 text-sm text-gray-600">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <span>{formattedTime}</span>
          </div>
        </div>

        {event.category && (
          <div className="mt-2">
            <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {event.category}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
