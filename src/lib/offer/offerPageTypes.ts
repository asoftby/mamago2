/**
 * Типы страницы оффера.
 * Этот файл — единственный источник правды для всех компонентов секции /offers.
 */

import type { NormalizedPhone } from "@/lib/phones/normalizePhones";
import type { FaqItem } from "@/lib/faq/faqItems";
import type { CanonicalCtaObject } from "@/lib/cta-platform";

export interface OfferMediaItem {
  id: string;
  url: string;
  alt?: string;
  /** Optional dimensions / blurhash for transformer layer */
  width?: number;
  height?: number;
  blurhash?: string;
}

/** Alias kept for backward compat with DB mapper / transformer */
export type OfferGalleryImage = OfferMediaItem;

export interface OfferMetaItem {
  id: string;
  label: string;
  value: string;
  /** Optional icon name (e.g. lucide icon id) — not used by UI components */
  icon?: string;
}

export interface OfferPricingOption {
  id: string;
  title: string;
  price: string;
  /** Optional legacy fields from old mock/mapper */
  description?: string;
  oldPrice?: string;
}

export interface OfferScheduleItem {
  id: string;
  title?: string;
  ageRange?: string;
  /** Дата начала — строка, например «1 июля» */
  dateFrom?: string;
  /** Дата окончания */
  dateTo?: string;
  duration?: string;
  price?: string;
  /** Кол-во мест всего */
  capacity?: number;
  /** Кол-во оставшихся мест */
  spotsLeft?: number;
  /** Показывать ли кнопку CTA */
  ctaEnabled?: boolean;
  ctaLabel?: string;
  /** Для расписания занятий (REGULAR) */
  groupName?: string;
  days?: string;
  time?: string;
  /** Legacy fields */
  oldPrice?: string;
  priceLabel?: string;
  promoLabel?: string;
  description?: string;
  promotionDetails?: string;
}

export interface ShiftCtaContext {
  shiftId: string;
  title?: string;
  dateFrom?: string;
  dateTo?: string;
  price?: string;
  ageRange?: string;
  promotionDetails?: string;
}

export interface OfferReview {
  id: string;
  authorName: string;
  authorAvatar?: string;
  date: string;
  rating: number;
  text?: string;
  /** Legacy helpful count */
  helpful?: number;
}

export interface OfferPerk {
  stat: string;
  label: string;
  desc?: string;
}

/** Offer type alias — kept for DB mapper / transformer backward compat */
export type OfferType = "CAMP" | "REGULAR" | "SINGLE";

/** CTA type alias — kept for offerPageFormat / offerPageData backward compat */
export type OfferCtaType =
  | "записаться"
  | "забронировать"
  | "купить_билет"
  | "отправить_заявку"
  | "перейти_на_сайт";

export interface OfferPageData {
  id: string;
  offerType: OfferType;
  citySlug: string;
  slug: string;
  title: string;
  shortDescription?: string;
  /** Long HTML description — not rendered by new UI components, kept for SEO / JSON-LD */
  description?: string;
  /** Review count — used by some pages directly */
  reviewsCount?: number;

  place?: {
    id: string;
    name: string;
    slug: string;
    address?: string;
    /** Editorial tagline shown under place name, e.g. "в шаге от метро" */
    tagline?: string;
    /** Extra amenity/feature chips */
    tags?: string[];
    /** Extended fields used by DB mapper */
    district?: string;
    metro?: string;
    lat?: number;
    lng?: number;
    logoUrl?: string;
    rating?: number;
    ratingsCount?: number;
    citySlug?: string;
  };

  media: {
    posterUrl?: string;
    posterAlt?: string;
    videoUrl?: string;
    /** Video button label, e.g. "Трейлер" */
    videoLabel?: string;
    /** Thumbnail for video preview card */
    videoThumbnail?: string;
    /** Duration string, e.g. "1:23" */
    videoDuration?: string;
    gallery: OfferMediaItem[];
  };

  metaGrid: OfferMetaItem[];

  pricing: {
    priceFrom?: string;
    singlePrice?: string;
    priceCaption?: string;
    promotionText?: string;
    promotionSubtitle?: string;
    options?: OfferPricingOption[];
    /** Clean numeric display price, e.g. "890" (shown large in booking card) */
    priceDisplay?: string;
    /** Price unit label shown next to large number, e.g. "BYN / смена" */
    priceUnit?: string;
    /** Discount list — shown as coloured badges in booking card */
    discounts?: Array<{ rate: string; label: string }>;
    /** Legacy fields from old mapper */
    mode?: string;
    promoTitle?: string;
    promoUntil?: string;
    promotionDetails?: string;
    oldPrice?: string;
  };

  averageRating?: number;

  cta: {
    primaryLabel: string;
    secondaryLabel?: string;
    /** Legacy extended fields */
    type?: OfferCtaType;
    phone?: string;
    phones?: NormalizedPhone[];
    link?: string;
    instructions?: string;
  };
  resolvedCta?: CanonicalCtaObject;

  schedule?: {
    type: "classes" | "shifts";
    items: OfferScheduleItem[];
  };

  reviews?: OfferReview[];
  faqItems?: FaqItem[];

  /** SEO metadata — used by programs page and JSON-LD builder */
  seo?: {
    title?: string;
    description?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    canonicalUrl?: string;
  };

  /** Camp accommodation block — used by old DB mapper */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  accommodation?: Record<string, any>;

  /** Similar offers — placeholder for future implementation */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  similar?: any[];

  /** Perks / highlights list — used by editorial insight section */
  perks?: OfferPerk[];

  /**
   * Bottom promo CTA block — editorial full-width section with countdown,
   * large serif headline and conversion buttons.
   */
  promoCta?: {
    /** Static timer label, e.g. "ДО КОНЦА АКЦИИ 14 ДНЕЙ · 17 ЧАСОВ" */
    timerLabel?: string;
    /** ISO date string — if provided, a live countdown is computed */
    promoUntil?: string;
    /** Full headline text, e.g. "Запишите ребёнка на лучшее лето." */
    headline: string;
    /** Word inside headline to italicize with accent colour */
    accentWord?: string;
    /** Subtitle / supporting copy below the headline */
    subtitle?: string;
    /** Primary CTA label, e.g. "Записаться за 650 BYN" */
    primaryLabel: string;
    /** Secondary CTA label, e.g. "Получить программу в Telegram" */
    secondaryLabel?: string;
    /** Secondary CTA href (Telegram link, etc.) */
    secondaryHref?: string;
    /** Trust micro-copy below buttons */
    trustLine?: string;
  };

  /**
   * Day schedule — list of time-based activities for camp/regular offers.
   * Used by the accordion "Расписание дня" section.
   */
  daySchedule?: Array<{
    time?: string;
    title: string;
    sub?: string;
    /** Highlights the row in accent colour */
    accent?: boolean;
  }>;

  /**
   * About paragraphs — plain text or HTML fragments shown in "Описание" accordion.
   * Falls back to data.description if not set.
   */
  about?: string[];

  /** Banner label shown in preview/draft mode */
  previewBannerLabel?: string;

  /** Hide publication stats in owner view */
  hidePublicationStats?: boolean;

  /** Discovery intent — used by recommendation engine */
  discoveryIntent?: string;
}
