import type { ContentStatus, PlaceKind, Prisma } from "@prisma/client";
import type { OpeningHoursData } from "@/components/openingHours";

/**
 * Unified form data for Place wizard
 * Used in both create and edit modes
 */
export interface PlaceFormData {
  // Identity
  id?: string;
  createdByUserId?: string;
  ownerBusinessId?: string | null;
  status?: ContentStatus;
  
  // Step 1: Profile
  title: string;
  category: string;
  shortDesc: string;
  description: string | null;
  ageTags: string[];
  visitFormats: string[];
  /// Новая структура категорий: ID корневой категории (EventCategory, publicationType=PLACE)
  primaryCategoryId: string | null;
  /// Упорядоченный массив ID подкатегорий (position=index). Первый = основная подкатегория.
  subcategoryIds: string[];
  
  // Step 2: Location
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  formattedAddr: string | null;
  addressJson: Prisma.InputJsonValue | null;
  customAddress: string | null;
  cityId: string | null;
  districtAutoId: string | null;
  districtManualId: string | null;
  metroAutoId: string | null;
  metroAutoDistanceM: number | null;
  metroManualId: string | null;
  metroManualDistanceM: number | null;
  
  // Display-only location fields (not persisted)
  displayDistrictName?: string | null;
  displayMetroName?: string | null;
  
  // Step 3: Contacts
  phone: string | null;
  website: string | null;
  instagramHandle: string | null;
  instagramUrl: string | null;
  
  // Step 4: Photos
  logoImageId: string | null;
  logoUrl: string | null;
  images: PlaceImage[];
  
  // Temp media tracking (for create mode)
  tempLogoMediaId?: string | null;
  tempGalleryMediaIds?: string[];

  // Step 5: Opening Hours
  openingHoursId: string | null;
  openingHoursData: OpeningHoursData | null;
  
  // Hierarchy
  placeKind: PlaceKind;
  floor: string | null;
  unit: string | null;
  
  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PlaceImage {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  kind: string;
  sortOrder: number;
}

export type PlaceWizardMode = "create" | "edit";

export interface PlaceWizardProps {
  mode: PlaceWizardMode;
  place?: PlaceFormData; // Required for edit mode
  onComplete?: (placeId: string) => void;
}

/**
 * Step validation result
 */
export interface StepValidation {
  isValid: boolean;
  isComplete: boolean;
  errors: string[];
}

/**
 * Wizard step status
 */
export type StepStatus = "current" | "completed" | "incomplete" | "locked";
