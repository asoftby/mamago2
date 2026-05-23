"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { isAppMediaUrl } from "@/lib/media/isAppMediaUrl";
import { OwnerPlaceEditDropdown } from "./OwnerPlaceEditDropdown";

interface PlaceHeroProps {
  title: string;
  shortDesc: string;
  categoryLabel?: string;
  city?: string;
  district?: string;
  address?: string;
  metro?: string;
  phone?: string;
  website?: string;
  instagramUrl?: string;
  logoUrl?: string | null;
  rating?: number;
  reviewCount?: number;
  workingHoursSummary?: string;
  isOpenNow?: boolean;
  todayHoursText?: string;
  breadcrumbItems: Array<{ label: string; href?: string }>;
  onShareClick?: () => void;
  ownerEditPlaceId?: string;
}

export function PlaceHero({
  title,
  shortDesc,
  categoryLabel,
  city,
  district,
  address,
  metro,
  phone,
  website,
  instagramUrl,
  logoUrl,
  rating,
  reviewCount,
  workingHoursSummary,
  isOpenNow,
  todayHoursText,
  breadcrumbItems,
  onShareClick,
  ownerEditPlaceId,
}: PlaceHeroProps) {
  const [saved, setSaved] = useState(false);

  const words = title.trim().split(/\s+/);
  const titleHead = words.length > 1 ? words.slice(0, -1).join(" ") : "";
  const titleTail = words[words.length - 1] + ".";

  const logoInitials = title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const websiteDisplay = website
    ? website.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : null;

  const instagramDisplay = instagramUrl
    ? "@" + instagramUrl.replace(/^https?:\/\/(www\.)?instagram\.com\/?/, "").replace(/\/$/, "")
    : null;

  return (
    <section
      style={{ paddingTop: 8, paddingBottom: 56, background: "#F6F2EA" }}
    >
      {/* Breadcrumbs */}
      <div
        className="breadcrumbs"
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "20px 28px 10px",
          display: "flex",
          gap: 8,
          alignItems: "center",
          color: "rgba(20,18,16,.55)",
          fontSize: 13,
          flexWrap: "wrap",
        }}
      >
        {breadcrumbItems.map((item, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {i > 0 && <span style={{ opacity: 0.5 }}>→</span>}
            {item.href ? (
              <Link href={item.href} style={{ color: "inherit", textDecoration: "none" }}>
                {item.label}
              </Link>
            ) : (
              <span style={{ color: "#141210" }}>{item.label}</span>
            )}
          </span>
        ))}
      </div>

      {/* Hero grid */}
      <div
        className="hero-grid"
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          padding: "0 28px",
          display: "grid",
          gridTemplateColumns: "1fr 420px",
          gap: 56,
          alignItems: "start",
        }}
      >
        {/* Left: editorial title */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Kicker */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 6,
              flexWrap: "wrap",
            }}
          >
            {categoryLabel && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 30,
                  padding: "0 12px",
                  borderRadius: 999,
                  background: "#FFE8DC",
                  color: "#C24E22",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                ● {categoryLabel}
              </span>
            )}
            {(city || district) && (
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  textTransform: "uppercase",
                  fontSize: 11,
                  letterSpacing: ".14em",
                  color: "rgba(20,18,16,.55)",
                }}
              >
                {[city, district].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>

          {/* Title */}
          <h1
            style={{
              fontFamily: "var(--font-display, Georgia, serif)",
              fontWeight: 400,
              fontSize: "clamp(56px, 9vw, 132px)",
              lineHeight: 0.92,
              letterSpacing: "-.025em",
              margin: "0 0 8px",
              color: "#141210",
            }}
          >
            {titleHead && (
              <>
                {titleHead}
                <br />
              </>
            )}
            <span style={{ fontStyle: "italic", color: "#C24E22" }}>{titleTail}</span>
          </h1>

          {/* Subtitle */}
          <div
            style={{
              maxWidth: 600,
              color: "#3A332B",
              fontSize: 19,
              lineHeight: 1.5,
              marginBottom: 8,
            }}
          >
            {shortDesc}
          </div>

          {/* Rating pill */}
          {rating != null && reviewCount != null && reviewCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 30,
                  padding: "0 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(20,18,16,.18)",
                  fontSize: 13,
                  color: "#3A332B",
                }}
              >
                ★ {rating.toFixed(1)}
              </span>
              <span style={{ fontSize: 13, color: "rgba(20,18,16,.55)" }}>
                {reviewCount} отзывов
              </span>
            </div>
          )}
        </div>

        {/* Right: sticky decision card */}
        <aside style={{ position: "sticky", top: 24 }}>
          <div
            style={{
              background: "#FAF7F1",
              border: "1px solid rgba(20,18,16,.10)",
              borderRadius: 18,
              padding: 24,
              boxShadow:
                "0 1px 0 rgba(255,255,255,.6) inset, 0 30px 60px -30px rgba(20,18,16,.18)",
            }}
          >
            {/* Logo + status */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    overflow: "hidden",
                    flexShrink: 0,
                    background: "#E86A3A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {logoUrl ? (
                    isAppMediaUrl(logoUrl) ? (
                      <img
                        src={logoUrl}
                        alt={title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <Image
                        src={logoUrl}
                        alt={title}
                        width={44}
                        height={44}
                        className="object-cover"
                      />
                    )
                  ) : (
                    <span
                      style={{
                        fontFamily: "var(--font-display, Georgia, serif)",
                        fontStyle: "italic",
                        fontWeight: 400,
                        fontSize: 18,
                        color: "#fff",
                      }}
                    >
                      {logoInitials}
                    </span>
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {/* Open/closed status — or place name fallback */}
                  <div
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      textTransform: "uppercase",
                      fontSize: 11,
                      letterSpacing: ".14em",
                      fontWeight: 500,
                      color: isOpenNow == null
                        ? "rgba(20,18,16,.45)"
                        : isOpenNow
                          ? "#1F8A5B"
                          : "rgba(20,18,16,.55)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isOpenNow != null
                      ? `● ${isOpenNow ? "Открыто" : "Закрыто"}`
                      : workingHoursSummary
                        ? `● ${workingHoursSummary.split("\n")[0].trim()}`
                        : title}
                  </div>
                  {/* Today's hours or summary first line */}
                  {(todayHoursText || workingHoursSummary) && (
                    <div
                      style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: 12,
                        color: "rgba(20,18,16,.55)",
                        marginTop: 2,
                        letterSpacing: ".02em",
                      }}
                    >
                      {todayHoursText
                        ? `сегодня ${todayHoursText}`
                        : workingHoursSummary!.split("\n")[0]}
                    </div>
                  )}
                </div>
              </div>
              {rating != null ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      textTransform: "uppercase",
                      fontSize: 13,
                      letterSpacing: ".08em",
                      color: "#C24E22",
                      fontWeight: 600,
                    }}
                  >
                    ★ {rating.toFixed(1)}
                  </span>
                  {reviewCount != null && reviewCount > 0 && (
                    <span style={{ fontSize: 11, color: "rgba(20,18,16,.55)", fontFamily: "var(--font-mono, monospace)" }}>
                      {reviewCount} отз.
                    </span>
                  )}
                </div>
              ) : null}
            </div>

            {/* Address */}
            {(address || metro) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  marginBottom: 14,
                  paddingBottom: 16,
                  borderBottom: "1px solid rgba(20,18,16,.10)",
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: 8,
                    background: "#FFE8DC",
                    color: "#C24E22",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                  }}
                >
                  📍
                </span>
                <div style={{ minWidth: 0, fontSize: 14, color: "#3A332B" }}>
                  {address && (
                    <div style={{ fontWeight: 600, color: "#141210", lineHeight: 1.35 }}>
                      {address}
                    </div>
                  )}
                  {metro && (
                    <div
                      style={{
                        fontFamily: "var(--font-mono, monospace)",
                        color: "#C24E22",
                        fontSize: 11,
                        marginTop: 4,
                        letterSpacing: ".06em",
                        textTransform: "uppercase",
                      }}
                    >
                      ● м. {metro}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contacts */}
            {(phone || website || instagramUrl) && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginBottom: 18,
                  paddingBottom: 18,
                  borderBottom: "1px solid rgba(20,18,16,.10)",
                }}
              >
                {phone && (
                  <ContactRow
                    icon="📞"
                    label="Телефон"
                    href={`tel:${phone}`}
                    value={phone}
                  />
                )}
                {website && websiteDisplay && (
                  <ContactRow
                    icon="↗"
                    label="Сайт"
                    href={website.startsWith("http") ? website : `https://${website}`}
                    value={websiteDisplay}
                    external
                  />
                )}
                {instagramUrl && instagramDisplay && (
                  <ContactRow
                    icon="◎"
                    label="Instagram"
                    href={instagramUrl}
                    value={instagramDisplay}
                    external
                  />
                )}
              </div>
            )}

            {/* Save / Share */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                color: "rgba(20,18,16,.55)",
              }}
            >
              <button
                onClick={() => setSaved((s) => !s)}
                style={{
                  background: "none",
                  border: 0,
                  padding: 0,
                  color: "inherit",
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <span
                  style={{
                    color: saved ? "#E86A3A" : "inherit",
                    transform: saved ? "scale(1.15)" : "none",
                    transition: "transform .25s",
                    display: "inline-block",
                  }}
                >
                  ♥
                </span>{" "}
                Сохранить
              </button>
              <button
                onClick={onShareClick}
                style={{
                  background: "none",
                  border: 0,
                  padding: 0,
                  color: "inherit",
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <span>↗</span> Поделиться
              </button>
            </div>

            {phone && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(20,18,16,.10)" }}>
                <Link
                  href={`tel:${phone}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    height: 46,
                    borderRadius: 10,
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
              </div>
            )}

            {ownerEditPlaceId && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(20,18,16,.10)" }}>
                <OwnerPlaceEditDropdown placeId={ownerEditPlaceId} className="w-full" />
              </div>
            )}
          </div>
        </aside>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
          }
        }
        @media (max-width: 1100px) {
          .hero-grid {
            padding: 0 22px !important;
          }
        }
      `}</style>
    </section>
  );
}

function ContactRow({
  icon,
  label,
  href,
  value,
  external,
}: {
  icon: string;
  label: string;
  href: string;
  value: string;
  external?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        fontSize: 13,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono, monospace)",
          textTransform: "uppercase",
          fontSize: 11,
          letterSpacing: ".14em",
          color: "rgba(20,18,16,.55)",
        }}
      >
        {icon} {label}
      </span>
      <Link
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        style={{ fontWeight: 500, color: "#141210", textDecoration: "none", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {value}
      </Link>
    </div>
  );
}
