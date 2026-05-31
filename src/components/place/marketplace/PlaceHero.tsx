"use client";

import { useState } from "react";
import { Heart, Phone } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { isAppMediaUrl } from "@/lib/media/isAppMediaUrl";
import { OwnerPlaceEditDropdown } from "./OwnerPlaceEditDropdown";
import {
  SidebarCard,
  SidebarCardSection,
  SidebarCardTopSection,
  SidebarCardAddressRow,
  SidebarCardContactRow,
  SidebarCardShare,
  SidebarCardPrimaryLink,
} from "@/components/shared/SidebarCard";

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
  const titleHead = words[0] ?? "";
  const titleTail = (words.length > 1 ? words.slice(1).join(" ") : "") + ".";

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
      style={{ paddingTop: 8, paddingBottom: 56, background: "#ffffff" }}
    >
      {/* Breadcrumbs */}
      <div
        className="breadcrumbs"
        style={{
          maxWidth: 1200,
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
          maxWidth: 1200,
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
                  color: "#E86A3A",
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
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: 40,
              lineHeight: 1.1,
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
            <span>{titleTail}</span>
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

        </div>

        {/* Right: sticky decision card */}
        <aside>
          <SidebarCard sticky>
            {/* Logo + status */}
            <SidebarCardSection mb={18} pb={16}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Logo circle */}
                  <div style={{ width: 44, height: 44, borderRadius: 99, overflow: "hidden", flexShrink: 0, background: "#E86A3A", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {logoUrl ? (
                      isAppMediaUrl(logoUrl) ? (
                        <img src={logoUrl} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <Image src={logoUrl} alt={title} width={44} height={44} className="object-cover" />
                      )
                    ) : (
                      <span style={{ fontFamily: "var(--font-display, Georgia, serif)", fontStyle: "italic", fontWeight: 400, fontSize: 18, color: "#fff" }}>
                        {logoInitials}
                      </span>
                    )}
                  </div>
                  {/* Status + hours */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: "var(--font-mono, monospace)", textTransform: "uppercase", fontSize: 11, letterSpacing: ".14em", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: isOpenNow == null ? "rgba(20,18,16,.45)" : isOpenNow ? "#1F8A5B" : "#C24E22" }}>
                      {isOpenNow != null ? `● ${isOpenNow ? "Открыто" : "Закрыто"}` : workingHoursSummary ? `● ${workingHoursSummary.split("\n")[0].trim()}` : title}
                    </div>
                    {(todayHoursText || workingHoursSummary) && (
                      <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12, color: "rgba(20,18,16,.55)", marginTop: 2, letterSpacing: ".02em" }}>
                        {todayHoursText ? `сегодня ${todayHoursText}` : workingHoursSummary!.split("\n")[0]}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SidebarCardSection>

            {/* Address */}
            {(address || metro || district) && (
              <SidebarCardSection mb={14} pb={16}>
                <SidebarCardAddressRow address={address} metro={metro} district={district} />
              </SidebarCardSection>
            )}

            {/* Contacts */}
            {(website || instagramUrl) && (
              <SidebarCardSection>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {website && websiteDisplay && (
                    <SidebarCardContactRow
                      label="Сайт"
                      href={website.startsWith("http") ? website : `https://${website}`}
                      value={websiteDisplay}
                      external
                    />
                  )}
                  {instagramUrl && instagramDisplay && (
                    <SidebarCardContactRow
                      label="Instagram"
                      href={instagramUrl}
                      value={instagramDisplay}
                      external
                    />
                  )}
                </div>
              </SidebarCardSection>
            )}

            {/* Позвонить + Сохранить */}
            <SidebarCardTopSection>
              <div className="flex items-center gap-3">
                {phone && (
                  <Link
                    href={`tel:${phone}`}
                    className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-[#EF8759] text-[15px] font-semibold text-white transition-colors hover:bg-[#E86A3A]"
                    style={{ textDecoration: "none" }}
                  >
                    <Phone className="h-4 w-4 shrink-0" />
                    Позвонить
                  </Link>
                )}
                <button
                  type="button"
                  aria-label={saved ? "Сохранено" : "Сохранить"}
                  onClick={() => setSaved((s) => !s)}
                  className={[
                    "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border transition-all",
                    saved
                      ? "border-[#E86A3A] bg-[#FFE8DC] text-[#C24E22]"
                      : "border-[rgba(20,18,16,0.18)] bg-transparent text-[rgba(20,18,16,0.45)] hover:border-[#141210] hover:text-[#141210]",
                  ].join(" ")}
                >
                  <Heart className={["h-5 w-5", saved ? "fill-current" : ""].join(" ")} />
                </button>
              </div>
            </SidebarCardTopSection>

            {/* Owner edit */}
            {ownerEditPlaceId && (
              <SidebarCardTopSection>
                <OwnerPlaceEditDropdown placeId={ownerEditPlaceId} className="w-full h-[52px] rounded-full" />
              </SidebarCardTopSection>
            )}

            {/* Rating + Share */}
            <SidebarCardTopSection mt={20} pt={20}>
              <div className="flex items-center justify-between">
                {rating != null && reviewCount != null && reviewCount > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] text-[rgba(20,18,16,0.55)]">
                      <span className="text-[16px] text-[#E86A3A]">★</span> {rating.toFixed(1)}
                    </span>
                    <span className="font-mono text-[13px] text-[rgba(20,18,16,0.55)]">· </span>
                    <a
                      href="#reviews"
                      className="font-mono text-[13px] text-[rgba(20,18,16,0.55)] transition-colors hover:text-[#141210]"
                      style={{ textDecoration: "underline", textDecorationStyle: "dashed", textDecorationColor: "#E86A3A", textUnderlineOffset: "3px" }}
                    >
                      {reviewCount} {reviewCount === 1 ? "отзыв" : reviewCount >= 2 && reviewCount <= 4 ? "отзыва" : "отзывов"}
                    </a>
                  </div>
                ) : <span />}
                <SidebarCardShare title={title} />
              </div>
            </SidebarCardTopSection>
          </SidebarCard>
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

