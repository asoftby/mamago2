"use client";

import { Instagram, Link2, Phone, Share2 } from "lucide-react";
import { useState } from "react";
import { ShareModal } from "@/components/shared/ShareModal";
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
  SidebarCardTopSection,
  SidebarCardAddressRow,
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
  /** Вторая строка статуса: «закроется в 18:00» / «откроется в 09:00». */
  hoursStatusDetail?: string;
  /** Коротко для шапки карточки: «до 18:00» / «с 09:00». */
  hoursStatusShort?: string;
  breadcrumbItems: Array<{ label: string; href?: string }>;
  onShareClick?: () => void;
  ownerEditPlaceId?: string;
  media?: {
    posterUrl?: string;
    posterAlt: string;
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
  district,
  address,
  metro,
  phones,
  website,
  instagramUrl,
  logoUrl,
  rating,
  reviewCount,
  isOpenNow,
  hoursStatusShort,
  breadcrumbItems,
  directSlot,
  onShareClick,
  ownerEditPlaceId,
  media,
}: PlaceHeroProps) {
  const [shareOpen, setShareOpen] = useState(false);
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

  return (
    <section
      style={{ paddingTop: 16, paddingBottom: 56, background: "#ffffff" }}
    >
      {/* Breadcrumbs */}
      <div
        className="breadcrumbs mx-auto w-full max-w-[1200px] px-4 pb-2.5 pt-5 sm:px-6 lg:px-7 hidden lg:flex"
        style={{
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
        className="hero-grid mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-7"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 420px",
          gap: 56,
          alignItems: "start",
        }}
      >
        {/* Left: editorial title */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Kicker */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            {categoryLabel && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 28,
                  padding: "0 12px",
                  borderRadius: 999,
                  background: "#FFE8DC",
                  color: "#E86A3A",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {categoryLabel}
              </span>
            )}
            {district && (
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  textTransform: "uppercase",
                  fontSize: 11,
                  letterSpacing: ".14em",
                  color: "rgba(20,18,16,.55)",
                }}
              >
                {district}
              </span>
            )}
            {/* Desktop: «Сохранить» и «Поделиться» справа в строке категории; на мобильном — иконки в хедере. */}
            <div className="ml-auto hidden items-center gap-5 lg:flex">
              <PlaceSaveHeart
                variant="text"
                registerInHeader
                placeId={placeId}
                placeSlug={placeSlug}
                placeTitle={title}
                coverImageUrl={logoUrl}
                source="place-detail"
              />
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="inline-flex items-center gap-2 text-[14px] font-medium text-[rgba(20,18,16,0.55)] transition-colors hover:text-[#141210]"
              >
                <Share2 size={18} strokeWidth={1.75} aria-hidden />
                Поделиться
              </button>
            </div>
          </div>
          <ShareModal
            open={shareOpen}
            onOpenChange={setShareOpen}
            url={typeof window !== "undefined" ? window.location.href : ""}
            title={title}
            entityNoun="местом"
          />

          {/* Title */}
          <h1
            className="text-[34px] sm:text-[40px]"
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "-.025em",
              margin: 0,
              color: "#141210",
            }}
          >
            {titleDisplay}
          </h1>

          {/* Subtitle */}
          <div
            className="text-[17px] sm:text-[19px]"
            style={{
              maxWidth: 600,
              color: "#3A332B",
              lineHeight: 1.5,
            }}
          >
            {shortDesc}
          </div>

          {/* Фото: на мобильном — первым блоком, как на десктопе (3 в ряд, первым Reels, если есть). */}
          {media && media.galleryItems.length > 0 && (
            <div className="order-first lg:order-none lg:mt-2">
              <MediaGalleryStrip items={media.galleryItems} maxVisible={3} />
            </div>
          )}
        </div>

        {/* Right: sticky decision card */}
        <aside>
          <SidebarCard sticky>
            {/* Логотип + название места + адрес и статус работы */}
            <div
              style={{
                marginBottom: 14,
                paddingBottom: metro || district ? 16 : 0,
                borderBottom: metro || district ? "1px solid rgba(20,18,16,.10)" : "none",
              }}
            >
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
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 16, lineHeight: 1.25, color: "#141210", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {title}
                  </div>
                  <div style={{ marginTop: 3, display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 2, fontSize: 13, color: "rgba(20,18,16,.55)", lineHeight: 1.35 }}>
                    {address && <span>{address}</span>}
                    {isOpenNow != null && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 500, color: isOpenNow ? "#1F8A5B" : "#C24E22" }}>
                        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 99, background: "currentColor", flexShrink: 0 }} />
                        {hoursStatusShort ?? (isOpenNow ? "Открыто" : "Закрыто")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Метро / район (адрес вынесен в шапку карточки) */}
            {(metro || district) && (
              <div style={{ marginBottom: 14 }}>
                <SidebarCardAddressRow metro={metro} district={district} />
              </div>
            )}

            {/* Позвонить */}
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
              </div>
              {directSlot && <div className="mt-3">{directSlot}</div>}
            </SidebarCardTopSection>

            {/* Owner edit */}
            {ownerEditPlaceId && (
              <SidebarCardTopSection>
                <OwnerPlaceEditDropdown placeId={ownerEditPlaceId} className="w-full h-14 rounded-full" />
              </SidebarCardTopSection>
            )}

            {/* Rating */}
            {rating != null && reviewCount != null && reviewCount > 0 ? (
              <SidebarCardTopSection mt={20} pt={20}>
                <div className="flex items-center justify-between">
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
                </div>
              </SidebarCardTopSection>
            ) : null}

            {/* Соцсети слева, сайт справа */}
            {(instagramUrl || (website && websiteDisplay)) && (
              <SidebarCardTopSection mt={20} pt={20}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {instagramUrl && (
                      <a
                        href={instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={instagramDisplay ? `Instagram ${instagramDisplay}` : "Instagram"}
                        onClick={() => trackCta("instagram")}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(20,18,16,0.18)] text-[rgba(20,18,16,0.55)] transition-colors hover:border-[#141210] hover:text-[#141210]"
                      >
                        <Instagram size={18} strokeWidth={1.75} aria-hidden />
                      </a>
                    )}
                  </div>
                  {website && websiteDisplay && (
                    <a
                      href={website.startsWith("http") ? website : `https://${website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackCta("website")}
                      className="inline-flex min-w-0 items-center gap-1.5 text-[14px] text-[rgba(20,18,16,0.55)] transition-colors hover:text-[#141210]"
                    >
                      <Link2 size={16} strokeWidth={1.75} className="shrink-0" aria-hidden />
                      <span className="truncate">{websiteDisplay}</span>
                    </a>
                  )}
                </div>
              </SidebarCardTopSection>
            )}
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
      `}</style>
    </section>
  );
}
