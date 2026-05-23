"use client";

import Link from "next/link";

interface PlaceAddressSectionProps {
  title: string;
  shortDesc?: string;
  address?: string;
  district?: string;
  metro?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  mapsDirectionsUrl?: string;
}

export function PlaceAddressSection({
  title,
  shortDesc,
  address,
  district,
  metro,
  phone,
  latitude,
  longitude,
  mapsDirectionsUrl,
}: PlaceAddressSectionProps) {
  const mapEmbedUrl =
    latitude && longitude
      ? `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}&q=${latitude},${longitude}&zoom=15`
      : undefined;

  return (
    <section
      style={{
        padding: "56px 0",
        borderTop: "1px solid rgba(20,18,16,.10)",
        background: "#F6F2EA",
      }}
    >
      <div
        className="location-grid"
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "0 28px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 32,
        }}
      >
        {/* Left: place title + shortDesc */}
        <div>
          <div className="kicker-row" style={{ marginBottom: 14 }}>
            <span className="text-kicker">07 — Как добраться</span>
            <span className="kicker-line" />
          </div>
          {(() => {
            const words = title.trim().split(/\s+/);
            const head = words.length > 1 ? words.slice(0, -1).join(" ") : "";
            const tail = words[words.length - 1] + ".";
            return (
              <h2
                className="font-display"
                style={{
                  fontSize: "clamp(36px, 5vw, 72px)",
                  margin: "0 0 16px",
                  letterSpacing: "-.025em",
                  lineHeight: 0.95,
                  color: "#141210",
                  fontWeight: 400,
                }}
              >
                {head && <>{head}<br /></>}
                <span className="font-display-italic" style={{ color: "#C24E22" }}>{tail}</span>
              </h2>
            );
          })()}

          {shortDesc && (
            <div style={{ fontSize: 17, lineHeight: 1.55, color: "rgba(20,18,16,.55)", maxWidth: 360, marginBottom: 28 }}>
              {shortDesc}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {mapsDirectionsUrl && (
              <Link
                href={mapsDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  height: 54,
                  padding: "0 24px",
                  borderRadius: 999,
                  background: "#141210",
                  color: "#FAF7F1",
                  fontWeight: 600,
                  fontSize: 15,
                  textDecoration: "none",
                }}
              >
                Маршрут <span>→</span>
              </Link>
            )}
            {phone && (
              <Link
                href={`tel:${phone}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 54,
                  padding: "0 24px",
                  borderRadius: 999,
                  border: "1px solid rgba(20,18,16,.18)",
                  background: "transparent",
                  color: "#141210",
                  fontWeight: 600,
                  fontSize: 15,
                  textDecoration: "none",
                }}
              >
                Позвонить
              </Link>
            )}
          </div>
        </div>

        {/* Right: map */}
        <div
          style={{
            background: "#FAF7F1",
            border: "1px solid rgba(20,18,16,.10)",
            borderRadius: 18,
            overflow: "hidden",
            aspectRatio: "4/3",
            position: "relative",
          }}
        >
          {mapEmbedUrl ? (
            <iframe
              src={mapEmbedUrl}
              width="100%"
              height="100%"
              style={{ border: 0, display: "block" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Карта местоположения"
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  "repeating-linear-gradient(135deg, rgba(20,18,16,.04) 0 1px, transparent 1px 14px), linear-gradient(180deg, #EFE8DA, #E2D8C8)",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 99,
                  background: "#E86A3A",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  boxShadow: "0 0 0 8px rgba(232,106,58,.22), 0 8px 24px rgba(20,18,16,.18)",
                }}
              >
                📍
              </div>
            </div>
          )}

          {/* Floating info card */}
          {address && (
            <div
              style={{
                position: "absolute",
                bottom: 16,
                left: 16,
                right: 16,
                padding: "12px 16px",
                borderRadius: 14,
                background: "rgba(250,247,241,.94)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: "1px solid rgba(20,18,16,.10)",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#141210" }}>{address}</div>
                {(metro || district) && (
                  <div
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: 11,
                      color: "rgba(20,18,16,.55)",
                      marginTop: 2,
                    }}
                  >
                    {[metro ? `м. ${metro}` : null, district ? `${district} район` : null].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              {mapsDirectionsUrl && (
                <Link
                  href={mapsDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: 36,
                    padding: "0 14px",
                    borderRadius: 999,
                    border: "1px solid rgba(20,18,16,.18)",
                    background: "transparent",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#141210",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  ↗ Маршрут
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .location-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
            padding: 0 22px !important;
          }
        }
        @media (max-width: 520px) {
          .location-grid { padding: 0 18px !important; }
        }
      `}</style>
    </section>
  );
}
