// Event Wizard Types

import type { ActivityFormat } from "@prisma/client";
import type { EventFormatPreset } from "@/lib/business/eventFormatSignals";
import type { EventScheduleItem } from "@/components/admin/event-schedule/types";
import type {
  AgeBucket,
  AgeDetectionConfidence,
} from "@/lib/age/ageMapping";

export type EventWizardMode = "create" | "edit";

/**
 * Complete Event Form Data
 * Covers all 9 steps of the wizard
 */
export interface EventFormData {
  // Step 1: Basics
  title: string;
  format: ActivityFormat;
  /** Пресет «как проходит событие» → при сохранении маппится в сигналы в scheduleJson */
  eventFormats: EventFormatPreset[];
  /**
   * Legacy: зеркало одного корня `[categoryId]` при сохранении; multi-select не используется.
   */
  categoryIds: string[];
  /**
   * Для выбранного корня: не более одной подкатегории в значении.
   */
  subcategoryIdsByCategoryId: Record<string, string[]>;

  /** Корневая категория события (родитель листа в справочнике). */
  categoryId: string | null;
  /** Подкатегория (лист), если у корня есть дочерние — обязательна. */
  subcategoryId: string | null;
  /** Синхронизируется из справочника: у корня есть дочерние категории → нужна подкатегория. */
  primaryRootHasChildren: boolean;
  /** id опций сигнала age (Discovery / Signals) */
  ageRangeIds: string[];
  /** Значения сигнала age для поля Activity.ageTags (синхронизируется с ageRangeIds) */
  ageTags: string[];
  ageDetection?: {
    raw: string | null;
    confidence: AgeDetectionConfidence;
    suggestedBuckets: AgeBucket[];
    normalizedLabel: string | null;
    parsedMinAge: number | null;
    parsedMaxAge: number | null;
  };
  /** Отключает авто-применение после первого осознанного действия пользователя. */
  ageDetectionUserOverride: boolean;
  /** Показывает, что текущее значение было именно автоприменено, а не выбрано вручную. */
  ageDetectionAutoApplied: boolean;
  /** id/values опций сигнала interests (Discovery / Signals, axis INTERESTS) */
  interestIds: string[];
  /**
   * Slug жанра (справочник Genre) по id корневой категории.
   * Загружается после выбора категории; ключ — `EventCategory.id` корня.
   */
  genreSlugByRootCategoryId: Record<string, string>;
  /** Slug выбранной категории (подкатегория или корень) — для кино и сохранения в scheduleJson */
  categorySlug: string | null;
  /** Подпись для review (корень → подкатегория), из справочника */
  categoryPathLabel: string | null;

  /** Категории «в программе» (many-to-many, только selectableInProgram). */
  programCategoryIds: string[];

  // Cinema-specific (conditional on category slug, см. isCinemaEventCategorySlug)
  cinemaGenre?: string;
  cinemaDuration?: number;
  cinemaTrailerUrl?: string;
  
  // Step 2: Description
  fullDescription: string; // maps to description
  
  // Step 3: Media
  coverImage: string | null; // coverImageId
  gallery: string[]; // ActivityImage[]
  reelsUrl?: string;
  
  // Step 4: Schedule (MVP: all dates use common time)
  scheduleMode: "single" | "multiple";
  dates: string[]; // YYYY-MM-DD
  scheduleItems: EventScheduleItem[];
  allDay: boolean;
  startTime: string; // HH:mm - common for all dates
  endTime: string; // HH:mm - common for all dates
  repeatEnabled: boolean;
  repeatUnit: "day" | "week" | "month" | "year" | null;
  repeatUntil: string | null; // YYYY-MM-DD
  
  // Step 5: Pricing & Participation
  pricingMode: "free" | "fixed" | "from";
  price: string;
  priceDetails: string; // Optional details for "from" mode (e.g., different ticket categories)
  ticketLink: string;
  /** Как попасть на событие (3 сценария; при загрузке старых данных нормализуется в маппере) */
  participationMode: "external-link" | "time-slots" | "walk-in" | "prebook";
  prebookMethod: "phone" | "link" | null;
  prebookPhone: string;
  prebookUrl: string;

  // Simple booking fields
  simpleBookingDate: string | null; // YYYY-MM-DD
  simpleBookingTime: string | null; // HH:mm–HH:mm
  simpleBookingCapacity: number | null;
  
  // Time slots (advanced)
  timeSlots: {
    dates: Array<{
      id: string;
      isoDate: string;
      label: string;
      slots: Array<{
        id: string;
        startTime: string;
        endTime: string;
        capacity: number;
      }>;
    }>;
  };
  
  // Step 2: Location (EventVenue)
  locationSource: "PLACE" | "MANUAL" | null; // NEW: Track location data source
  venueKind: "PLACE" | "MANUAL" | "MOBILE" | "TBD" | null;
  placeId: string | null;
  venueName: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  
  // District fields (like Place)
  districtAutoId: string | null; // Automatically determined district ID
  districtManualId: string | null; // Manually selected district ID
  districtName: string | null; // District name for display
  
  // Metro fields (like Place)
  metroAutoId: string | null; // Automatically determined metro ID
  metroAutoDistanceM: number | null; // Distance to auto metro in meters
  metroManualId: string | null; // Manually selected metro ID
  metroManualDistanceM: number | null; // Distance to manual metro in meters
  metroName: string | null; // Metro name for display
  
  // Legacy fields (for backward compatibility)
  district: string;
  metro: string;
  
  source: "PLACE" | "ADDRESS_INPUT" | "MAP_PICKER" | "MOBILE" | "TBD" | null;
  venueNote: string;
  
  // Step 7: Contacts
  contactMode: "inherit" | "override";
  phone: string;
  website: string;
  socialLinks: SocialLink[];
  
  // Step 8: Organizer
  organizerMode: "existing" | "import" | "manual";
  organizerId: string | null;
  organizerName: string;
  organizerUnp: string;
  organizerPhone: string;
  organizerWebsite: string;
  organizerInstagram: string;
}

export interface SocialLink {
  id: string; // client-side ID
  network: "instagram" | "telegram" | "tiktok" | "youtube" | "other";
  url: string;
}

/**
 * Draft validation rules (soft)
 * Minimum required to save as draft
 */
export const DRAFT_REQUIRED = {
  title: true,
  categoryId: true,
} as const;

/**
 * Submit validation rules (strict)
 * Required for moderation submission
 */
export const SUBMIT_REQUIRED = {
  // Step 1
  title: true,
  eventFormats: true,
  categoryId: true,
  ageRangeIds: true, // at least one id
  
  // Step 2
  fullDescription: true,
  
  // Step 3
  coverImage: true,
  
  // Step 4
  dates: true, // at least one
  startTime: true, // if allDay=false
  
  // Step 5
  price_or_ticketLink: true, // if isFree=false
  
  // Step 6
  location: true, // placeId OR (venueName + address + city)
  
  // Step 8
  organizerName: true,
} as const;
