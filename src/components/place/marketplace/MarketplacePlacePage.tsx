"use client";

import { useRef } from "react";
import { PlaceHero } from "./PlaceHero";
import { PlaceStickyActionBar } from "./PlaceStickyActionBar";
import { PlaceEventsSection } from "./PlaceEventsSection";
import { PlaceOffersSection } from "./PlaceOffersSection";
import { PlaceAboutSection } from "./PlaceAboutSection";
import { PlaceAddressSection } from "./PlaceAddressSection";
import { PlaceReviewsSection } from "./PlaceReviewsSection";
import { PlaceNetworkSection, type NetworkPlace } from "@/components/place/PlaceNetworkSection";
import { PriceListBlock } from "@/components/shared/PriceListBlock";
import { MobileSmartBackButton } from "@/components/shared/MobileSmartBackButton";
import { FaqSection } from "@/components/public/FaqSection";
import type { ActivityMock } from "@/types/activity";
import type { PriceData } from "@/lib/priceItems";
import type { FaqItem } from "@/lib/faq/faqItems";
import type { NormalizedPlacePhone } from "@/lib/place/placePhones";
import type { MediaGalleryItem } from "@/lib/media/galleryTypes";
import type { CanonicalCtaObject } from "@/lib/cta-platform";
import { DirectRequestCta } from "@/components/direct/DirectRequestCta";

interface MarketplacePlacePageProps {
  place: {
    id: string;
    title: string;
    slug: string;
    shortDesc: string;
    description: string;
    logoUrl?: string | null;
    rating?: number;
    reviewCount?: number;

    // Contact
    phones: NormalizedPlacePhone[];
    website?: string;
    instagramUrl?: string;
    facebookUrl?: string;
    vkUrl?: string;
    youtubeUrl?: string;
    telegramUrl?: string;
    tiktokUrl?: string;

    // Location
    address?: string;
    city?: string;
    district?: string;
    metro?: string;
    latitude?: number;
    longitude?: number;
    /** Основная категория места (для hero) */
    categoryLabel?: string;

    // Breadcrumbs & Maps
    breadcrumbItems: Array<{ label: string; href?: string }>;
    mapsOpenUrl?: string;
    mapsDirectionsUrl?: string;
    workingHoursSummary?: string;
    isOpenNow?: boolean;
    todayHoursText?: string;

    // Additional info
    yearFounded?: number;
    ageRange?: string;
    format?: string;
    categories?: string[];

    // Media
    media?: {
      galleryItems: MediaGalleryItem[];
    };

    priceData?: PriceData;
    faqItems?: FaqItem[];
    updatedAt?: Date | string | null;
    fallbackUrl?: string;
    resolvedCta?: CanonicalCtaObject;
  };

  eventActivities?: ActivityMock[];
  citySlug?: string;

  offers?: Array<{
    id: string;
    title: string;
    slug: string;
    kind: string;
    campProgramType?: string | null;
    imageUrl?: string;
    description?: string;
    price?: number;
    category?: string;
    duration?: string;
  }>;

  reviews?: Array<{
    id: string;
    source: "MAMAGO" | "GOOGLE";
    authorName: string;
    authorAvatarUrl?: string | null;
    rating: number;
    text?: string | null;
    publishedAt: Date | string;
    relativeTimeDescription?: string | null;
    ownerReplyText?: string | null;
    ownerReplyAuthorName?: string | null;
    ownerReplyCreatedAt?: Date | string | null;
  }>;

  /** Показать «Редактировать» с шагами визарда (те же права, что у редактора места). */
  ownerEditPlaceId?: string;
  relatedPlaces?: NetworkPlace[];
  sectionNotes?: {
    offers?: string;
    events?: string;
    reviews?: string;
    relatedPlaces?: string;
  };
  /** Direct "Отправить заявку" CTA — omitted when the place has no owning Business (rule 5). */
  direct?: {
    placeId: string;
    publicationTitle: string;
    brandName: string;
  };
}

export function MarketplacePlacePage({
  place,
  eventActivities = [],
  citySlug = "minsk",
  offers = [],
  reviews = [],
  ownerEditPlaceId,
  relatedPlaces = [],
  sectionNotes,
  direct,
}: MarketplacePlacePageProps) {
  const ctaRef = useRef<HTMLDivElement>(null);
  const hasRenderableReviews = reviews.length > 0;
  const displayReviewCount = hasRenderableReviews ? place.reviewCount : undefined;
  const displayRating = hasRenderableReviews ? place.rating : undefined;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: place.title,
        text: place.shortDesc,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  // Build meta strip items from available data.
  // Рейтинг намеренно не дублируем в meta-strip — он уже есть в сайдбар-карточке.
  const metaItems: Array<[string, string, string]> = [];
  if (place.ageRange) metaItems.push(["Возраст", place.ageRange, String(metaItems.length + 1).padStart(2, "0")]);
  if (place.workingHoursSummary) {
    const hoursFirstLine = place.workingHoursSummary.split("\n")[0].trim();
    // Extract only "Откроется в X" / "До X" part, not the open/closed status prefix
    const afterBullet = hoursFirstLine.includes("•") ? hoursFirstLine.split("•").slice(1).join("•").trim() : hoursFirstLine;
    const hoursDisplay = afterBullet || hoursFirstLine;
    if (hoursDisplay) metaItems.push(["Часы", hoursDisplay, String(metaItems.length + 1).padStart(2, "0")]);
  }
  if (place.metro) metaItems.push(["Метро", place.metro, String(metaItems.length + 1).padStart(2, "0")]);
  if (place.district && metaItems.length < 5) metaItems.push(["Район", place.district, String(metaItems.length + 1).padStart(2, "0")]);

  const summaryPrimary = place.workingHoursSummary
    ?.split("\n")
    .map((line) => line.trim())
    .filter(Boolean)[0];
  const stickyAddressLine = place.address?.trim() || undefined;
  const stickyStatusLabel = (() => {
    if (place.isOpenNow != null) {
      const status = place.isOpenNow ? "Открыто" : "Закрыто";
      return place.todayHoursText
        ? `${status} · сегодня ${place.todayHoursText}`
        : status;
    }
    if (summaryPrimary) {
      return summaryPrimary.split("•")[0]?.trim() || summaryPrimary;
    }
    if (!stickyAddressLine) {
      return [place.city, place.district].filter(Boolean).join(" · ") || undefined;
    }
    return undefined;
  })();
  const stickyDetailLine = place.title;

  return (
    <div
      className="pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0"
      style={{ background: "#ffffff", minHeight: "100vh" }}
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-4 sm:px-6 lg:px-8">
        <MobileSmartBackButton fallbackHref={place.fallbackUrl} />
      </div>

      {/* Hero */}
      <PlaceHero
        ctaRef={ctaRef}
        placeId={place.id}
        placeSlug={place.slug}
        title={place.title}
        shortDesc={place.shortDesc}
        address={place.address}
        metro={place.metro}
        phones={place.phones}
        website={place.website}
        instagramUrl={place.instagramUrl}
        logoUrl={place.logoUrl}
        rating={displayRating}
        reviewCount={displayReviewCount}
        categoryLabel={place.categoryLabel}
        city={place.city}
        district={place.district}
        workingHoursSummary={place.workingHoursSummary}
        isOpenNow={place.isOpenNow}
        todayHoursText={place.todayHoursText}
        breadcrumbItems={place.breadcrumbItems}
        onShareClick={handleShare}
        ownerEditPlaceId={ownerEditPlaceId}
        media={place.media}
        directSlot={
          direct && (
            <DirectRequestCta
              publicationRef={{ publicationType: "PLACE", placeId: direct.placeId }}
              publicationTitle={direct.publicationTitle}
              brandName={direct.brandName}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full border border-[rgba(20,18,16,0.18)] bg-transparent text-[15px] font-semibold text-[#141210] transition-colors hover:border-[#141210]"
            >
              Отправить заявку
            </DirectRequestCta>
          )
        }
      />

      {/* Meta strip */}
      {metaItems.length > 0 && (
        <MetaStrip items={metaItems} isOpenNow={place.isOpenNow} />
      )}

      {/* About */}
      <PlaceAboutSection
        description={place.description}
        yearFounded={place.yearFounded}
        ageRange={place.ageRange}
        format={place.format}
        categories={place.categories}
      />

      <FaqSection items={place.faqItems} />

      {/* Working Hours */}
      {place.workingHoursSummary && (
        <WorkingHoursSection summary={place.workingHoursSummary} />
      )}

      {/* Price list */}
      {place.priceData && (place.priceData.items.length > 0 || place.priceData.note.trim()) && (
        <section
          style={{
            padding: "56px 0",
            borderTop: "1px solid rgba(20,18,16,.10)",
            background: "#ffffff",
          }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px" }}>
            <div className="kicker-row" style={{ marginBottom: 24 }}>
              <span className="text-kicker">Цены</span>
              <span className="kicker-line" />
            </div>
            <PriceListBlock
              items={place.priceData.items}
              note={place.priceData.note}
              updatedAt={place.updatedAt}
            />
          </div>
        </section>
      )}

      {/* Offers */}
      {offers.length > 0 && (
        <>
          <SectionNote text={sectionNotes?.offers} />
          <PlaceOffersSection offers={offers} placeId={place.slug} />
        </>
      )}

      {/* Events */}
      {eventActivities.length > 0 && (
        <>
          <SectionNote text={sectionNotes?.events} />
          <PlaceEventsSection activities={eventActivities} citySlug={citySlug} />
        </>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <>
          <SectionNote text={sectionNotes?.reviews} />
          <PlaceReviewsSection
            reviews={reviews}
            placeId={place.slug}
            rating={displayRating}
            reviewCount={displayReviewCount}
          />
        </>
      )}

      {relatedPlaces.length > 0 && (
        <>
          <SectionNote text={sectionNotes?.relatedPlaces} />
          <PlaceNetworkSection places={relatedPlaces} />
        </>
      )}

      {/* Address / Location */}
      <PlaceAddressSection
        title={place.title}
        logoUrl={place.logoUrl}
        shortDesc={place.shortDesc ?? undefined}
        address={place.address}
        district={place.district}
        metro={place.metro}
        latitude={place.latitude}
        longitude={place.longitude}
        mapsDirectionsUrl={place.mapsDirectionsUrl}
      />

      <PlaceStickyActionBar
        ctaRef={ctaRef}
        statusLabel={stickyStatusLabel}
        addressLine={stickyAddressLine}
        detailLine={stickyDetailLine}
        phones={place.phones}
        placeId={place.id}
        placeSlug={place.slug}
        placeTitle={place.title}
        coverImageUrl={place.logoUrl}
        directSlot={
          direct && (
            <DirectRequestCta
              publicationRef={{ publicationType: "PLACE", placeId: direct.placeId }}
              publicationTitle={direct.publicationTitle}
              brandName={direct.brandName}
              className="inline-flex h-[46px] shrink-0 items-center gap-2 rounded-full border border-[rgba(20,18,16,0.18)] bg-[rgba(250,247,241,0.95)] px-4 text-[14px] font-semibold text-[#141210] transition-colors hover:border-[#141210]"
            >
              Заявка
            </DirectRequestCta>
          )
        }
      />
    </div>
  );
}

function SectionNote({ text }: { text?: string }) {
  if (!text) return null;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
        {text}
      </div>
    </div>
  );
}

/* ─── Meta strip ────────────────────────────────────────────────────────── */

function MetaStrip({ items, isOpenNow }: { items: Array<[string, string, string]>; isOpenNow?: boolean }) {
  return (
    <section
      style={{
        borderTop: "1px solid rgba(20,18,16,.10)",
        borderBottom: "1px solid rgba(20,18,16,.10)",
        background: "#ffffff",
      }}
    >
      <div
        className="meta-grid"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 28px",
          display: "grid",
          gridTemplateColumns: `repeat(${items.length}, 1fr)`,
          gap: 0,
        }}
      >
        {items.map(([label, value, n], i) => (
          <div
            key={i}
            style={{
              padding: "22px 22px 22px 0",
              borderLeft: i === 0 ? "none" : "1px solid rgba(20,18,16,.10)",
              paddingLeft: i === 0 ? 0 : 22,
              display: "flex",
              flexDirection: "column",
              gap: 6,
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
            <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-.01em", color: "#141210", display: "flex", alignItems: "center", gap: 6 }}>
              {label === "Часы" && isOpenNow != null && (
                <span style={{ fontSize: 14, color: isOpenNow ? "#1F8A5B" : "#C24E22", flexShrink: 0, lineHeight: 1 }}>●</span>
              )}
              {value}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .meta-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .meta-grid > div {
            border-top: 1px solid rgba(20,18,16,.10);
            border-left: none !important;
            padding-left: 0 !important;
          }
          .meta-grid > div:nth-child(-n+2) { border-top: none !important; }
          .meta-grid > div:nth-child(even) { padding-left: 20px !important; border-left: 1px solid rgba(20,18,16,.10) !important; }
        }
        @media (max-width: 520px) {
          .meta-grid { grid-template-columns: 1fr !important; }
          .meta-grid > div { padding-left: 0 !important; border-left: none !important; border-top: 1px solid rgba(20,18,16,.10) !important; }
          .meta-grid > div:first-child { border-top: none !important; }
        }
      `}</style>
    </section>
  );
}

/* ─── Working Hours ─────────────────────────────────────────────────────── */

// Days that appear in the schedule text (labels match buildPublicWorkingHoursText)
const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DAY_FULL_NAMES: Record<string, string> = {
  "Пн": "Понедельник",
  "Вт": "Вторник",
  "Ср": "Среда",
  "Чт": "Четверг",
  "Пт": "Пятница",
  "Сб": "Суббота",
  "Вс": "Воскресенье",
};

function WorkingHoursSection({ summary }: { summary: string }) {
  const lines = summary.split("\n").map((l) => l.trim()).filter(Boolean);
  const statusLine = lines[0] ?? "";
  const isByAppointment = statusLine.toLowerCase() === "по записи";
  const noteLines = isByAppointment ? lines.slice(1) : [];
  // Day rows: "Пн: 09:00–18:00" or "Пн: выходной"
  const dayRows = lines.filter((l) => DAY_LABELS.some((d) => l.startsWith(d + ":")));
  const isOpen = statusLine.toLowerCase().startsWith("открыто");

  if (isByAppointment && noteLines.length === 0 && dayRows.length === 0) {
    return null;
  }

  const leftStatusText = isByAppointment
    ? noteLines.join("\n")
    : !isOpen && statusLine
      ? statusLine
      : isOpen
        ? statusLine
        : "";

  return (
    <section
      style={{
        padding: "56px 0",
        borderTop: "1px solid rgba(20,18,16,.10)",
        background: "#ffffff",
      }}
    >
      <div
        className="hours-grid"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 28px",
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 56,
        }}
      >
        {/* Left */}
        <div>
          <div className="kicker-row" style={{ marginBottom: 18 }}>
            <span className="text-kicker">Часы работы</span>
            <span className="kicker-line" />
          </div>
          <h2
            style={{ fontSize: 30, lineHeight: 1, margin: "0", letterSpacing: "-.02em", color: "#141210", fontFamily: "var(--font-sans)", fontWeight: 400 }}
          >
            {isOpen ? (
              <>Открыто <em style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic", fontWeight: 400, color: "#1F8A5B" }}>сейчас</em></>
            ) : (
              <>Режим <em style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic", fontWeight: 400, color: "#C24E22" }}>работы</em></>
            )}
          </h2>
          {leftStatusText ? (
            <p style={{ fontSize: 15, marginTop: 14, maxWidth: 260, lineHeight: 1.5, color: "rgba(20,18,16,.55)" }}>
              {!isOpen && !isByAppointment && statusLine ? (
                <>
                  <span style={{ color: "#C24E22", display: "block" }}>{statusLine.split("•")[0]?.trim()}</span>
                  {statusLine.includes("•") && (
                    <span style={{ display: "block" }}>{statusLine.split("•").slice(1).join("•").trim()}</span>
                  )}
                </>
              ) : (
                leftStatusText
              )}
            </p>
          ) : null}
        </div>

        {/* Right: schedule */}
        <div>
          {dayRows.length > 0 ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "1px solid rgba(20,18,16,.10)" }}>
              {dayRows.map((row, i) => {
                const [dayLabel, ...rest] = row.split(":");
                const timeStr = rest.join(":").trim();
                const isClosed = timeStr === "выходной";
                const isToday = (new Date().getDay() + 6) % 7 === i; // Mon=0
                return (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      padding: "14px 4px",
                      borderBottom: "1px solid rgba(20,18,16,.10)",
                      background: isToday
                        ? "linear-gradient(90deg, rgba(232,106,58,.08) 0%, transparent 40%)"
                        : "transparent",
                    }}
                  >
                    <span style={{ fontWeight: isToday ? 600 : 400, color: "#141210", fontSize: 16 }}>
                      {DAY_FULL_NAMES[dayLabel.trim()] ?? dayLabel}
                      {isToday && (
                        <span
                          style={{
                            marginLeft: 10,
                            fontFamily: "var(--font-mono, monospace)",
                            fontSize: 10,
                            letterSpacing: ".12em",
                            textTransform: "uppercase",
                            color: "#C24E22",
                          }}
                        >
                          сегодня
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: 14,
                        color: isClosed ? "rgba(20,18,16,.35)" : isToday ? "#141210" : "rgba(20,18,16,.55)",
                        textDecoration: isClosed ? "line-through" : "none",
                      }}
                    >
                      {timeStr}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : noteLines.length > 0 ? (
            <p style={{ fontSize: 17, color: "rgba(20,18,16,.55)", margin: 0, lineHeight: 1.5 }}>
              {noteLines.join("\n")}
            </p>
          ) : isByAppointment ? null : (
            <p style={{ fontSize: 17, color: "rgba(20,18,16,.55)", margin: 0, lineHeight: 1.5 }}>
              {summary}
            </p>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .hours-grid { grid-template-columns: 1fr !important; gap: 24px !important; padding: 0 22px !important; }
        }
        @media (max-width: 520px) {
          .hours-grid { padding: 0 18px !important; }
        }
      `}</style>
    </section>
  );
}
