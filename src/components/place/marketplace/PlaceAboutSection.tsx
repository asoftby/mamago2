"use client";

import { RichContentRenderer } from "@/components/content/RichContentRenderer";
import { cn } from "@/lib/utils";

interface PlaceAboutSectionProps {
  description: string;
  yearFounded?: number;
  ageRange?: string;
  format?: string;
  categories?: string[];
}

export function PlaceAboutSection({
  description,
  yearFounded,
  ageRange,
  format,
  categories,
}: PlaceAboutSectionProps) {
  const chips = [
    ...(categories ?? []),
    ageRange ? `${ageRange}` : null,
    format ?? null,
    yearFounded ? `с ${yearFounded}` : null,
  ].filter(Boolean) as string[];

  const hasContent =
    description.trim().length > 0 || chips.length > 0;

  if (!hasContent) return null;

  return (
    <section
      style={{
        padding: "80px 0 56px",
        borderTop: "1px solid rgba(20,18,16,.10)",
        background: "#ffffff",
      }}
    >
      <div
        className="about-grid mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-7"
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 56,
        }}
      >
        {/* Left: heading */}
        <div>
          <div className="kicker-row" style={{ marginBottom: 18 }}>
            <span className="text-kicker">О месте</span>
            <span className="kicker-line" />
          </div>
          <h2
            style={{
              fontSize: 30,
              lineHeight: 1,
              margin: "0",
              letterSpacing: "-.02em",
              color: "#141210",
              fontFamily: "var(--font-sans)",
              fontWeight: 400,
            }}
          >
            Всё{" "}
            <em style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic", fontWeight: 400, color: "#E86A3A" }}>
              о месте
            </em>
          </h2>
        </div>

        {/* Right: description + chips */}
        <div>
          {description.trim().length > 0 && (
            <div className="place-about-desc">
              <RichContentRenderer
                html={description}
                className={cn(
                  "prose-gray max-w-none mb-0",
                  "text-[17px] leading-[1.55] tracking-[-0.005em] sm:text-[19px] sm:leading-[1.5]",
                  "prose-p:text-[17px] prose-p:leading-[1.55] prose-p:text-[#141210] sm:prose-p:text-[19px] sm:prose-p:leading-[1.5]",
                  "prose-headings:text-[#141210] prose-strong:text-[#141210]",
                )}
              />
              <style>{`.place-about-desc p { margin-top: 1.8rem !important; margin-bottom: 1.8rem !important; } .place-about-desc p:first-child { margin-top: 0 !important; } .place-about-desc p:last-child { margin-bottom: 0 !important; }`}</style>
            </div>
          )}

          {/* Key info rows */}
          {(ageRange || format || yearFounded) && (
            <div
              style={{
                marginTop: 28,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 0,
                borderTop: "1px solid rgba(20,18,16,.10)",
              }}
            >
              {ageRange && (
                <InfoItem n="01" label="Возраст" value={ageRange} />
              )}
              {format && (
                <InfoItem n="02" label="Формат" value={format} />
              )}
              {yearFounded && (
                <InfoItem n="03" label="Основана" value={`${yearFounded}`} />
              )}
            </div>
          )}

          {/* Category chips */}
          {chips.length > 0 && (
            <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
              {chips.map((chip, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: 30,
                    padding: "0 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(20,18,16,.18)",
                    background: "#FAF7F1",
                    fontSize: 13,
                    color: "#3A332B",
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>
          )}

        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .about-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
      `}</style>
    </section>
  );
}

function InfoItem({ n, label, value }: { n: string; label: string; value: string }) {
  return (
    <div
      style={{
        padding: "20px 0",
        borderBottom: "1px solid rgba(20,18,16,.10)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontFamily: "var(--font-mono, monospace)",
            textTransform: "uppercase",
            fontSize: 11,
            letterSpacing: ".14em",
            color: "rgba(20,18,16,.55)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono, monospace)",
            color: "rgba(20,18,16,.55)",
            fontSize: 11,
          }}
        >
          {n}
        </span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-.01em", color: "#141210" }}>
        {value}
      </div>
    </div>
  );
}
