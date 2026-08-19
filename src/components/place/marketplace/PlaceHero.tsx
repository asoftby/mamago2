"use client";

import { Phone } from "lucide-react";
import { PlaceSaveHeart } from "@/features/save/PlaceSaveHeart";
import Link from "next/link";
import Image from "next/image";
import { isAppMediaUrl } from "@/lib/media/isAppMediaUrl";
import { OwnerPlaceEditDropdown } from "./OwnerPlaceEditDropdown";
import type { NormalizedPlacePhone } from "@/lib/place/placePhones";
import { PlacePhoneActionButton } from "@/components/place/PlacePhoneActions";
import { postAnalyticsEvent } from "@/lib/analytics/client";
import {
  SidebarCard,
  SidebarCardSection,
  SidebarCardTopSection,
  SidebarCardAddressRow,
  SidebarCardContactRow,
  SidebarCardShare,
} from "@/components/shared/SidebarCard";
import { MediaGalleryStrip } from "@/components/media/MediaGalleryStrip";
import type { MediaGalleryItem } from "@/lib/media/galleryTypes";

interface PlaceHeroProps {
  ctaRef?: React.RefObject<HTMLDivElement | null>;
  placeId: string;
  placeSlug: string;
  title: string;
  shortDesc: string;
  categoryLabel?: string;
  city?: string;
  district?: string;
  address?: string;
  metro?: string;
  phones: NormalizedPlacePhone[];
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
  media?: {
    galleryItems: MediaGalleryItem[];
  };
  /** Optional "Отправить заявку" CTA (Direct) — additive, rendered after the existing buttons. */
  directSlot?: React.ReactNode;
}

export function PlaceHero({
  ctaRef,
  placeId,
  placeSlug,
  title,
  shortDesc,
  categoryLabel,
  city,
  district,
  address,
  metro,
  phones,
  website,
  instagramUrl,
  logoUrl,
  rating,
  reviewCount,
  workingHoursSummary,
  isOpenNow,
  todayHoursText,
  breadcrumbItems,
  directSlot,
  onShareClick,
  ownerEditPlaceId,
  media,
}: PlaceHeroProps) {
  const trimmedTitle = title.trim();
  // Заголовок одной строкой (без принудительного переноса после первого слова),
  // с editorial-точкой в конце, если её ещё нет.
  const titleDisplay = /[.!?]$/.test(trimmedTitle) ? trimmedTitle : `${trimmedTitle}.`;

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

  const trackCta = (targetAction: string) => {
    void postAnalyticsEvent({
      eventType: "CTA_CLICK",
      entityType: "PLACE",
      entityId: placeId,
      vertical: "CITY",
      meta: { source: "detail", targetAction },
    });
  };

  const summaryLines =
    workingHoursSummary
      ?.split("\n")
      .map((line) => line.trim())
      .filter(Boolean) ?? [];
  const summaryPrimary = summaryLines[0];
  const summaryExtra =
    summaryLines.length > 1 ? summaryLines.slice(1).join("\n") : undefined;
  const hoursDetail = todayHoursText
    ? `сегодня ${todayHoursText}`
    : isOpenNow != null
      ? summaryPrimary
      : summaryExtra;

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
            {titleDisplay}
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

          {media && media.galleryItems.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <MediaGalleryStrip items={media.galleryItems} maxVisible={3} />
            </div>
          )}
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
                      <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 400, fontSize: 18, color: "#fff" }}>
                        {logoInitials}
                      </span>
                    )}
                  </div>
                  {/* Status + hours */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: "var(--font-mono, monospace)", textTransform: "uppercase", fontSize: 11, letterSpacing: ".14em", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: isOpenNow == null ? "rgba(20,18,16,.45)" : isOpenNow ? "#1F8A5B" : "#C24E22" }}>
                      {isOpenNow != null
                        ? `● ${isOpenNow ? "Открыто" : "Закрыто"}`
                        : summaryPrimary
                          ? `● ${summaryPrimary}`
                          : title}
                    </div>
                    {hoursDetail && (
                      <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12, color: "rgba(20,18,16,.55)", marginTop: 2, letterSpacing: ".02em" }}>
                        {hoursDetail}
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

            {/* Contacts (телефоны не дублируем — есть кнопка «Позвонить») */}
            {(website || instagramUrl) && (
              <SidebarCardSection>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {website && websiteDisplay && (
                    <SidebarCardContactRow
                      label="Сайт"
                      href={website.startsWith("http") ? website : `https://${website}`}
                      value={websiteDisplay}
                      external
                      onClick={() => trackCta("website")}
                    />
                  )}
                  {instagramUrl && instagramDisplay && (
                    <SidebarCardContactRow
                      label="Instagram"
                      href={instagramUrl}
                      value={instagramDisplay}
                      external
                      onClick={() => trackCta("instagram")}
                    />
                  )}
                </div>
              </SidebarCardSection>
            )}

            {/* Позвонить + Сохранить */}
            <SidebarCardTopSection>
              <div ref={ctaRef} className="flex items-center gap-3">
                {phones.length > 0 && (
                  <PlacePhoneActionButton
                    phones={phones}
                    placeTitle={title}
                    className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-[#EF8759] text-[15px] font-semibold text-white transition-colors hover:bg-[#E86A3A]"
                    onClick={() => trackCta("call")}
                  >
                    <Phone className="h-4 w-4 shrink-0" />
                    Позвонить
                  </PlacePhoneActionButton>
                )}
                <PlaceSaveHeart
                  placeId={placeId}
                  placeSlug={placeSlug}
                  placeTitle={title}
                  coverImageUrl={logoUrl}
                  source="place-detail"
                />
              </div>
              {directSlot && <div className="mt-3">{directSlot}</div>}
            </SidebarCardTopSection>

            {/* Owner edit */}
            {ownerEditPlaceId && (
              <SidebarCardTopSection>
                <OwnerPlaceEditDropdown placeId={ownerEditPlaceId} className="w-full h-14 rounded-full" />
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
                <SidebarCardShare title={title} entityNoun="местом" />
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
