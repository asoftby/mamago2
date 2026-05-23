"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { isAppMediaUrl } from "@/lib/media/isAppMediaUrl";
import Image from "next/image";

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
  if (events.length === 0) return null;

  return (
    <section
      style={{
        padding: "56px 0",
        borderTop: "1px solid rgba(20,18,16,.10)",
        background: "#F6F2EA",
      }}
    >
      <div
        style={{ maxWidth: 1320, margin: "0 auto", padding: "0 28px" }}
        className="events-wrap"
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 34,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="kicker-row" style={{ marginBottom: 14 }}>
              <span className="text-kicker">05 — Афиша</span>
              <span className="kicker-line" style={{ width: 120 }} />
            </div>
            <h2
              className="font-display"
              style={{
                fontSize: 48,
                margin: 0,
                letterSpacing: "-.02em",
                color: "#141210",
              }}
            >
              Что{" "}
              <span className="font-display-italic" style={{ color: "#C24E22" }}>
                происходит
              </span>
              .
            </h2>
          </div>
          <Link
            href={`/places/${placeId}#events`}
            style={{
              fontSize: 14,
              color: "#3A332B",
              textDecoration: "underline",
              textUnderlineOffset: 4,
              whiteSpace: "nowrap",
            }}
          >
            Все события →
          </Link>
        </div>

        {/* 4-col card grid */}
        <div
          className="events-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
          }}
        >
          {events.slice(0, 4).map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .events-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .events-wrap { padding: 0 22px !important; }
        }
        @media (max-width: 520px) {
          .events-grid { grid-template-columns: 1fr !important; }
          .events-wrap { padding: 0 18px !important; }
        }
      `}</style>
    </section>
  );
}

function EventCard({ event }: { event: Event }) {
  const eventDate = new Date(event.startDate);
  const formattedDate = format(eventDate, "d MMM · EEE", { locale: ru });

  return (
    <Link
      href={`/events/${event.slug}`}
      style={{ display: "flex", flexDirection: "column", gap: 12, textDecoration: "none" }}
    >
      {/* Image */}
      <div
        style={{
          aspectRatio: "4/5",
          borderRadius: 14,
          overflow: "hidden",
          position: "relative",
          background: "repeating-linear-gradient(135deg, rgba(20,18,16,.05) 0 1px, transparent 1px 12px), linear-gradient(180deg, #E9E2D6, #DDD3C2)",
        }}
      >
        {event.imageUrl && (
          isAppMediaUrl(event.imageUrl) ? (
            <img
              src={event.imageUrl}
              alt={event.title}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transition: "transform 1.2s cubic-bezier(.2,.7,.2,1)" }}
            />
          ) : (
            <Image
              src={event.imageUrl}
              alt={event.title}
              fill
              sizes="(max-width: 520px) 100vw, (max-width: 900px) 50vw, 25vw"
              className="object-cover"
            />
          )
        )}
        {/* Date badge */}
        <span
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            height: 26,
            padding: "0 10px",
            borderRadius: 999,
            background: "rgba(250,247,241,.94)",
            backdropFilter: "blur(6px)",
            fontSize: 11,
            fontWeight: 500,
            color: "#141210",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          {formattedDate}
        </span>
        {/* Price badge */}
        {event.price && (
          <span
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              height: 26,
              padding: "0 10px",
              borderRadius: 999,
              background: "#E86A3A",
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            от {event.price} BYN
          </span>
        )}
      </div>

      {/* Meta */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {event.category && (
          <div
            style={{
              fontFamily: "var(--font-mono, monospace)",
              textTransform: "uppercase",
              fontSize: 10,
              letterSpacing: ".12em",
              color: "rgba(20,18,16,.55)",
            }}
          >
            {event.category}
          </div>
        )}
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "-.01em",
            lineHeight: 1.25,
            color: "#141210",
          }}
        >
          {event.title}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 12,
            color: "rgba(20,18,16,.55)",
            marginTop: 4,
          }}
        >
          {formattedDate}
        </div>
      </div>
    </Link>
  );
}
