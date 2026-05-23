"use client";

import { RichContentRenderer } from "@/components/content/RichContentRenderer";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface PlaceAboutSectionProps {
  description: string;
  phone?: string;
  website?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  vkUrl?: string;
  youtubeUrl?: string;
  telegramUrl?: string;
  tiktokUrl?: string;
  yearFounded?: number;
  ageRange?: string;
  format?: string;
  categories?: string[];
}

export function PlaceAboutSection({
  description,
  phone,
  website,
  instagramUrl,
  facebookUrl,
  vkUrl,
  youtubeUrl,
  telegramUrl,
  tiktokUrl,
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

  const socialLinks = [
    { url: instagramUrl, label: "Instagram", icon: "◎" },
    { url: facebookUrl, label: "Facebook", icon: "f" },
    { url: vkUrl, label: "VK", icon: "VK" },
    { url: youtubeUrl, label: "YouTube", icon: "▶" },
    { url: telegramUrl, label: "Telegram", icon: "✈" },
    { url: tiktokUrl, label: "TikTok", icon: "♪" },
  ].filter((l) => l.url);

  const hasContent =
    description.trim().length > 0 || chips.length > 0 || socialLinks.length > 0;

  if (!hasContent) return null;

  return (
    <section
      style={{
        padding: "80px 0 56px",
        borderTop: "1px solid rgba(20,18,16,.10)",
        background: "#F6F2EA",
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "0 28px",
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 56,
        }}
        className="about-grid"
      >
        {/* Left: heading */}
        <div>
          <div className="kicker-row" style={{ marginBottom: 18 }}>
            <span className="text-kicker">01 — О месте</span>
            <span className="kicker-line" />
          </div>
          <h2
            className="font-display"
            style={{
              fontSize: 48,
              lineHeight: 1,
              margin: "0",
              letterSpacing: "-.02em",
              color: "#141210",
            }}
          >
            Всё о{" "}
            <span className="font-display-italic" style={{ color: "#C24E22" }}>
              месте
            </span>
            .
          </h2>

          {/* Social links */}
          {socialLinks.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 28 }}>
              {socialLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.label}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 38,
                    height: 38,
                    borderRadius: 99,
                    border: "1px solid rgba(20,18,16,.18)",
                    background: "#FAF7F1",
                    color: "#3A332B",
                    fontSize: 14,
                    textDecoration: "none",
                    transition: "background .2s",
                  }}
                >
                  {link.icon}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right: description + chips */}
        <div>
          {description.trim().length > 0 && (
            <RichContentRenderer
              html={description}
              className={cn(
                "prose-gray max-w-none mb-0",
                "text-[19px] leading-[1.5] tracking-[-0.005em]",
                "prose-p:text-[19px] prose-p:leading-[1.5] prose-p:text-[#141210] prose-p:my-5 [&>p:last-child]:mb-0 [&>p:first-child]:mt-0",
                "prose-headings:text-[#141210] prose-strong:text-[#141210]",
                "[&>p:first-child]:mt-0",
              )}
            />
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

          {/* Website + phone */}
          {(website || phone) && (
            <div
              style={{
                marginTop: 28,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              {phone && (
                <Link
                  href={`tel:${phone}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    height: 46,
                    padding: "0 20px",
                    borderRadius: 999,
                    border: "1px solid rgba(20,18,16,.18)",
                    background: "#FAF7F1",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#141210",
                    textDecoration: "none",
                  }}
                >
                  📞 {phone}
                </Link>
              )}
              {website && (
                <Link
                  href={website.startsWith("http") ? website : `https://${website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    height: 46,
                    padding: "0 20px",
                    borderRadius: 999,
                    border: "1px solid rgba(20,18,16,.18)",
                    background: "transparent",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#141210",
                    textDecoration: "none",
                  }}
                >
                  ↗ {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </Link>
              )}
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
        @media (max-width: 1100px) {
          .about-grid {
            padding: 0 22px !important;
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
