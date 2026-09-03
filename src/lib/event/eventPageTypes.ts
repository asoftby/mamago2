/**
 * View model for the public event decision page (mamaGo 2.0).
 * Adapter layers map Prisma Activity / API payloads into this shape.
 */

import type { Intent } from "@/lib/intent";
import type { MediaGalleryItem } from "@/lib/media/galleryTypes";
import type { NormalizedPhone } from "@/lib/phones/normalizePhones";
import type { FaqItem } from "@/lib/faq/faqItems";
import type { CanonicalCtaObject } from "@/lib/cta-platform";
import type { PriceItem } from "@/lib/priceItems";

export type EventPageBreadcrumb = {
  label: string;
  href: string;
};

export type EventPageSession = {
  id: string;
  /** ISO 8601 */
  startsAt: string;
};

export type EventPageMedia = {
  posterUrl: string;
  posterAlt: string;
  /** Intrinsic poster dimensions used to preserve its ratio before it loads. */
  posterWidth?: number;
  posterHeight?: number;
  /** 16:9 YouTube embed id — shown after poster. */
  trailerYoutubeId?: string;
  trailerLabel?: string;
  /** Vertical in-page embed — after trailer (e.g. Instagram reel or Shorts embed URL). */
  reel?: {
    label: string;
    iframeSrc: string;
  };
};

export type EventPageFactChip = {
  id: string;
  label: string;
};

export type EventPageVenue = {
  name: string;
  logoUrl?: string;
  address?: string;
  district?: string;
  metro?: string;
  landmark?: string;
  lat?: number;
  lng?: number;
  mapUrl?: string;
  routeUrl?: string;
  /** Публичная страница места (/{city}/places/{slug|id}) */
  placeHref?: string;
};

export type EventBookingSlot = {
  id: string;
  isoDate: string;
  startTime: string;
  endTime?: string;
  capacity?: number;
};

export type EventSimpleBookingData = {
  activityId: string;
  /** Для режима simple-booking — одна дата/время */
  date?: string;
  time?: string;
  /** Для режима time-slots — список доступных слотов */
  slots?: EventBookingSlot[];
};

export type EventPageCtaConfig = {
  planLabel: string;
  buyLabel: string;
  saveLabel: string;
  /** URL для покупки/записи. Если не задан — кнопку "Купить билет" не показываем. */
  purchaseUrl?: string;
  /** Данные для записи через встроенную форму (режим simple-booking). */
  simpleBooking?: EventSimpleBookingData;
  /** Контактные телефоны события (свои или унаследованные от площадки). */
  phones?: NormalizedPhone[];
};

export type EventPageSimilar = {
  id: string;
  title: string;
  imageUrl: string;
  dateLabel?: string;
  priceLabel?: string;
  categoryLabel?: string;
  ageLabel?: string;
  href: string;
};

export type EventPageData = {
  id: string;
  /** SEO-slug для публичного URL; если нет — в ссылках используется id */
  slug?: string | null;
  citySlug: string;
  /** true, если все сессии/даты события уже в прошлом */
  isPastEvent: boolean;
  /** Раздел (Куда пойти / Занятия / …) — для хедера на странице публикации */
  discoveryIntent: Intent;
  /** Бэйдж «5+» из возрастных диапазонов — перед категорией в шапке решения. */
  ageFromBadge?: string;
  categoryLabel?: string;
  title: string;
  subtitle: string;
  /** Compact fact chips under title (age, duration, format, …). */
  factChips: EventPageFactChip[];
  /** Structured facts for “Что важно знать”. */
  importantFacts: { id: string; label: string; value: string }[];
  media: EventPageMedia;
  sessions: EventPageSession[];
  venue?: EventPageVenue;
  /** “Почему стоит пойти” — short bullets. */
  whyGo: string[];
  /** “Кому подойдёт”. */
  goodFit: string[];
  /** Long-form sections (expandable in UI). */
  about: {
    /** Short summary for preview (plain text) */
    summary: string;
    /** Full description (plain text, deprecated - use descriptionHtml) */
    full?: string;
    /** Full description as HTML from rich text editor */
    descriptionHtml?: string;
    /** Bullet points / highlights */
    highlights?: string[];
  };
  planDayLinks?: {
    nearbyHref?: string;
  };
  organizerNote?: string;
  similar: EventPageSimilar[];
  breadcrumbs: EventPageBreadcrumb[];
  priceLabel: string;
  priceDetails?: string;
  /** Structured price rows filled in the Event wizard. */
  priceItems?: PriceItem[];
  /** Optional note attached to the structured price list. */
  priceNote?: string;
  /** Registration / tickets utility copy. */
  bookingNotes?: string;
  faqItems?: FaqItem[];
  cta: EventPageCtaConfig;
  resolvedCta?: CanonicalCtaObject;
  /**
   * Медиа-галерея под cover image: Reels (первой) + дополнительные фото события.
   * Пустой массив или undefined → блок не отображается.
   */
  galleryItems?: MediaGalleryItem[];
  /** @deprecated используйте galleryItems — Reels попадает туда первым */
  reelsUrl?: string;
  /** Редактирование в `/editor/event/...` — только для владельца (сервер подставляет href). */
  ownerEditHref?: string;
  /** Owner preview: label above the page (e.g. moderation status). */
  previewBannerLabel?: string;
  /** Hide publication stats (owner preview). */
  hidePublicationStats?: boolean;
};
