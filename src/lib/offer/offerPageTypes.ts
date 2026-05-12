/**
 * Offer Page Types
 * Типы данных для публичной страницы предложения
 */

import type { Intent } from "@/lib/intent";

export type OfferType = "SINGLE" | "REGULAR" | "CAMP";

export type OfferCtaType = 
  | "записаться" 
  | "забронировать" 
  | "купить_билет" 
  | "отправить_заявку" 
  | "перейти_на_сайт";

export interface OfferPageData {
  id: string;
  slug: string;
  citySlug: string;
  
  // Basic Info
  title: string;
  shortDescription: string;
  description: string; // Rich HTML
  offerType: OfferType;
  
  // Media
  media: {
    posterUrl: string;
    posterAlt: string;
    gallery: OfferGalleryImage[];
    videoUrl?: string | null;
    videoThumbnail?: string | null;
    videoDuration?: string | null;
    videoLabel?: string | null; // "Трейлер", "Как проходят занятия"
  };
  
  // Meta Grid (Quick Facts)
  metaGrid: OfferMetaItem[];
  
  // Pricing
  pricing: {
    mode: "single" | "multiple";
    singlePrice?: string;
    singleCurrency?: string;
    priceCaption?: string;
    priceFrom?: string;
    options?: OfferPricingOption[];
    promotionText?: string;
    promotionSubtitle?: string;
  };
  
  // Schedule / Sessions (for REGULAR and CAMP)
  schedule?: {
    type: "classes" | "shifts"; // classes для REGULAR, shifts для CAMP
    items: OfferScheduleItem[];
  };
  
  // Accommodation (for CAMP only)
  accommodation?: {
    provided: boolean;
    type?: string;
    address?: string;
    rooms?: string;
    conditions?: string;
    meals?: string[];
    mealInfo?: string;
    transferInfo?: string;
    whatToBring?: string;
    safetyInfo?: string;
    medicalInfo?: string;
  };
  
  // Location
  place?: {
    id: string;
    name: string;
    slug: string;
    address?: string;
    district?: string;
    metro?: string;
    lat?: number;
    lng?: number;
  };
  
  // Reviews (только внутренние mamaGo)
  reviews: OfferReview[];
  reviewsCount: number;
  averageRating?: number;
  
  // CTA
  cta: {
    type: OfferCtaType;
    primaryLabel: string;
    secondaryLabel?: string;
    phone?: string;
    link?: string;
    instructions?: string;
  };
  
  // Related Content
  similar: OfferSimilarItem[];
  
  // SEO
  seo: {
    title?: string;
    description?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    canonicalUrl?: string;
  };
  
  // Preview Banner (for draft/moderation)
  previewBannerLabel?: string;
  
  // Stats
  hidePublicationStats?: boolean;
  
  // Discovery Intent (для контекста навигации)
  discoveryIntent?: Intent;
}

export interface OfferGalleryImage {
  id: string;
  url: string;
  width?: number;
  height?: number;
  blurhash?: string;
  alt?: string;
}

export interface OfferMetaItem {
  id: string;
  icon?: string;
  label: string;
  value: string;
}

export interface OfferPricingOption {
  id: string;
  title: string;
  price: string;
  oldPrice?: string;
  description?: string;
}

export interface OfferScheduleItem {
  id: string;
  // For classes (REGULAR)
  groupName?: string;
  days?: string;
  time?: string;
  // For shifts (CAMP)
  title?: string;
  dateFrom?: string;
  dateTo?: string;
  duration?: string;
  ageRange?: string;
  spotsLeft?: number;
  capacity?: number;
  // Common
  price?: string;
  description?: string;
  ctaLabel?: string;
  ctaEnabled?: boolean;
}

/** Контекст конкретной смены, передаётся в CTA-обработчик */
export interface ShiftCtaContext {
  shiftId: string;
  title?: string;
  dateFrom?: string;
  dateTo?: string;
  price?: string;
  ageRange?: string;
}

export interface OfferReview {
  id: string;
  authorName: string;
  authorAvatar?: string;
  rating: number;
  text: string;
  date: string;
  helpful?: number;
}

export interface OfferSimilarItem {
  id: string;
  title: string;
  slug: string;
  coverUrl: string;
  priceLabel?: string;
  ageLabel?: string;
  placeTitle?: string;
  rating?: number;
  reviewsCount?: number;
}
