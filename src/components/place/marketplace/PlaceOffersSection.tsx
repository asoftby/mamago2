"use client";

import { BelarusianRubleIcon } from "@/components/icons/BelarusianRubleIcon";
import Link from "next/link";
import Image from "next/image";
import { getOfferPublicPath } from "@/lib/offers/offerPublicUrl";
import { isAppMediaUrl } from "@/lib/media/isAppMediaUrl";

interface Offer {
  id: string;
  title: string;
  slug: string;
  kind: string;
  campProgramType?: string | null;
  durationType?: string | null;
  imageUrl?: string;
  description?: string;
  price?: number;
  category?: string;
  duration?: string;
}

interface PlaceOffersSectionProps {
  offers: Offer[];
  placeId: string;
  citySlug?: string;
}

export function PlaceOffersSection({
  offers,
  placeId,
  citySlug = "minsk",
}: PlaceOffersSectionProps) {
  if (offers.length === 0) return null;

  return (
    <section
      style={{
        padding: "56px 0",
        borderTop: "1px solid rgba(20,18,16,.10)",
        background: "#ffffff",
      }}
    >
      <div
        style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px" }}
        className="offers-wrap"
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
              <span className="text-kicker">Предложения</span>
              <span className="kicker-line" style={{ width: 120 }} />
            </div>
            <h2
              style={{
                fontSize: 30,
                margin: 0,
                letterSpacing: "-.02em",
                color: "#141210",
                fontFamily: "var(--font-sans)",
                fontWeight: 400,
              }}
            >
              Чему{" "}
              <em style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 400, color: "#C24E22" }}>
                научим
              </em>
            </h2>
          </div>
          <Link
            href={`/places/${placeId}#offers`}
            style={{
              fontSize: 14,
              color: "#3A332B",
              textDecoration: "underline",
              textUnderlineOffset: 4,
              whiteSpace: "nowrap",
            }}
          >
            Все предложения →
          </Link>
        </div>

        {/* 4-col card grid */}
        <div
          className="offers-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
          }}
        >
          {offers.slice(0, 4).map((offer) => (
            <OfferCardEditorial
              key={offer.id}
              offer={offer}
              href={getOfferPublicPath(offer, citySlug)}
            />
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .offers-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .offers-wrap { padding: 0 22px !important; }
        }
        @media (max-width: 520px) {
          .offers-grid { grid-template-columns: 1fr !important; }
          .offers-wrap { padding: 0 18px !important; }
        }
      `}</style>
    </section>
  );
}

function OfferCardEditorial({ offer, href }: { offer: Offer; href: string }) {
  const categoryLabel = offer.category ?? offer.kind;

  return (
    <Link
      href={href}
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
        {offer.imageUrl && (
          isAppMediaUrl(offer.imageUrl) ? (
            <img
              src={offer.imageUrl}
              alt={offer.title}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Image
              src={offer.imageUrl}
              alt={offer.title}
              fill
              sizes="(max-width: 520px) 100vw, (max-width: 900px) 50vw, 25vw"
              className="object-cover"
            />
          )
        )}
        {/* Price badge */}
        {offer.price && (
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
            от {offer.price} <BelarusianRubleIcon />
          </span>
        )}
      </div>

      {/* Meta */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {categoryLabel && (
          <div
            style={{
              fontFamily: "var(--font-mono, monospace)",
              textTransform: "uppercase",
              fontSize: 10,
              letterSpacing: ".12em",
              color: "rgba(20,18,16,.55)",
            }}
          >
            {categoryLabel}
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
          {offer.title}
        </div>
        {offer.price && (
          <div
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 12,
              color: "rgba(20,18,16,.55)",
              marginTop: 4,
            }}
          >
            от {offer.price} <BelarusianRubleIcon />
          </div>
        )}
      </div>
    </Link>
  );
}
