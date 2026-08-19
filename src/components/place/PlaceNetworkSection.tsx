import Link from "next/link";
import { NetworkPlaceLogo } from "./NetworkPlaceLogo";

export type NetworkPlace = {
  id: string;
  title: string;
  href: string;
  category?: string | null;
  logoUrl?: string | null;
  metro?: string | null;
  district?: string | null;
};

export type PlaceNetworkSectionProps = {
  places: NetworkPlace[];
};

export function PlaceNetworkSection({ places }: PlaceNetworkSectionProps) {
  if (!places?.length) return null;

  return (
    <section
      aria-labelledby="network-places-title"
      style={{
        padding: "56px 0",
        borderTop: "1px solid rgba(20,18,16,.10)",
        background: "#ffffff",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px" }} className="network-wrap">
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
              <span className="text-kicker">Сеть</span>
              <span className="kicker-line" style={{ width: 120 }} />
            </div>
            <h2
              id="network-places-title"
              style={{
                fontSize: 30,
                margin: 0,
                letterSpacing: "-.02em",
                color: "#141210",
                fontFamily: "var(--font-sans)",
                fontWeight: 400,
              }}
            >
              Другие места{" "}
              <em
                style={{
                  fontFamily: "var(--font-editorial)",
                  fontStyle: "italic",
                  fontWeight: 400,
                  color: "#E86A3A",
                }}
              >
                сети
              </em>
            </h2>
          </div>
          <p
            style={{
              margin: 0,
              maxWidth: 280,
              fontSize: 14,
              lineHeight: 1.45,
              color: "rgba(20,18,16,.55)",
              textAlign: "right",
            }}
          >
            Места, которые связаны с этой локацией
          </p>
        </div>

        <div
          className="network-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}
        >
          {places.map((place) => (
            <NetworkPlaceCard key={place.id} place={place} />
          ))}
        </div>
      </div>

      <style>{`
        .network-card {
          transition: transform .2s, border-color .2s, box-shadow .2s;
        }
        .network-card:hover {
          transform: translateY(-3px);
          border-color: #E86A3A;
          box-shadow: 0 14px 30px -18px rgba(232,106,58,.45);
        }
        @media (max-width: 900px) {
          .network-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .network-wrap { padding: 0 22px !important; }
        }
        @media (max-width: 520px) {
          .network-grid { grid-template-columns: 1fr !important; }
          .network-wrap { padding: 0 18px !important; }
        }
      `}</style>
    </section>
  );
}

function NetworkPlaceCard({ place }: { place: NetworkPlace }) {
  const location = [place.metro, place.district].filter(Boolean) as string[];

  return (
    <Link
      href={place.href}
      className="network-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        borderRadius: 16,
        border: "1px solid rgba(20,18,16,.10)",
        background: "#fff",
        padding: 18,
        textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <NetworkPlaceLogo name={place.title} logoUrl={place.logoUrl} />
        <div style={{ minWidth: 0 }}>
          {place.category && (
            <p
              style={{
                margin: "0 0 4px",
                fontFamily: "var(--font-mono, monospace)",
                textTransform: "uppercase",
                fontSize: 10,
                letterSpacing: ".12em",
                color: "rgba(20,18,16,.55)",
              }}
            >
              {place.category}
            </p>
          )}
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "-.01em",
              lineHeight: 1.25,
              color: "#141210",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {place.title}
          </h3>
        </div>
      </div>

      {location.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderTop: "1px solid rgba(20,18,16,.08)",
            paddingTop: 12,
            fontSize: 13,
            color: "rgba(20,18,16,.55)",
          }}
        >
          {location.map((part, i) => (
            <span key={part} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {i > 0 && <span style={{ color: "rgba(20,18,16,.35)" }}>·</span>}
              {part}
            </span>
          ))}
          <span aria-hidden style={{ marginLeft: "auto", color: "rgba(20,18,16,.35)" }}>
            ↗
          </span>
        </div>
      )}
    </Link>
  );
}
