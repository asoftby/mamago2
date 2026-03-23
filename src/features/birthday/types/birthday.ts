import type { AgeOption } from "@/lib/config/ages";

// ─── Offer domain ────────────────────────────────────────────────────────────

export type BirthdayOfferType =
  | "BIRTHDAY_PACKAGE"
  | "BIRTHDAY_VENUE_OFFER"
  | "BIRTHDAY_SERVICE_OFFER"
  | "BIRTHDAY_ADDON";

export type BirthdayOfferCategory =
  | "PACKAGE"
  | "VENUE"
  | "ANIMATOR"
  | "SHOW"
  | "MASTER_CLASS"
  | "CAKE"
  | "DECOR"
  | "PHOTO"
  | "FOOD"
  | "ADDON";

export type BirthdayFormat = "HOME" | "VENUE" | "OUTDOOR";

/** Which layer this offer belongs to in the builder */
export type OfferLayer = "BASE" | "ENTERTAINMENT" | "FOOD" | "DECOR" | "EXTRA";

/** Compatibility constraints for an offer */
export type OfferCompatibility = {
  /** Compatible with these base types */
  compatibleBaseTypes?: Array<"HOME" | "VENUE" | "OUTDOOR" | "PACKAGE">;
  /** Only works with these specific venue IDs */
  compatibleVenueIds?: string[];
  /** Cannot work with these venue IDs */
  incompatibleVenueIds?: string[];
  /** Requires a venue to be selected */
  requiresSelectedVenue?: boolean;
  /** This offer is exclusive to a specific venue (can't be used elsewhere) */
  isVenueExclusive?: boolean;
};

export type BirthdayOffer = {
  id: string;
  title: string;
  type: BirthdayOfferType;
  category: BirthdayOfferCategory;
  /** Which builder layer this offer belongs to */
  layer: OfferLayer;
  city: string;
  district?: string;
  ageMin?: number;
  ageMax?: number;
  /** Canonical age options for ranking (optional; can derive from age tags via resolveAgeOptionsFromKeys) */
  ageOptions?: AgeOption[];
  guestsMin?: number;
  guestsMax?: number;
  priceFrom?: number;
  priceTo?: number;
  currency: "BYN";
  formatTags?: BirthdayFormat[];
  image: string;
  shortDescription?: string;
  businessName?: string;
  businessId?: string;
  rating?: number;
  reviewCount?: number;
  isFeatured?: boolean;
  /** For VENUE/PACKAGE offers: what's included */
  venueIncludes?: string[];
  /** Compatibility constraints */
  compatibility?: OfferCompatibility;
};

// ─── Quiz inputs ─────────────────────────────────────────────────────────────

export type BirthdayAgeGroup = "0-3" | "3-5" | "5-8" | "8-12";
export type BirthdayGuestsGroup = "up5" | "5-10" | "10-15" | "15plus";
export type BirthdayBudgetGroup = "up300" | "300-600" | "600-1000" | "1000plus" | "unknown";
export type BirthdayFormatChoice = "HOME" | "VENUE" | "OUTDOOR" | "unknown";
export type BirthdayTheme =
  | "princess"
  | "superhero"
  | "dinosaur"
  | "unicorn"
  | "pirate"
  | "science"
  | "art"
  | "sport"
  | "any";

export type BirthdayQuizInputs = {
  ageGroup: BirthdayAgeGroup | null;
  budgetGroup: BirthdayBudgetGroup | null;
  guestsGroup: BirthdayGuestsGroup | null;
  theme: BirthdayTheme | null;
  format: BirthdayFormatChoice | null;
};

// ─── Selection ───────────────────────────────────────────────────────────────

export type ConflictReason =
  | "format_mismatch"
  | "venue_required"
  | "age_mismatch"
  | "guests_mismatch";

export type SelectedAddon = {
  offerId: string;
  /** conflict = incompatible with current base, but not yet removed */
  status: "selected" | "conflict";
  conflictReason?: ConflictReason;
};

export type BirthdaySelection = {
  /** The chosen base offer (venue or package) */
  selectedBaseId: string | null;
  /** All chosen addon offers with their status */
  selectedAddons: SelectedAddon[];
};

// ─── Builder state ───────────────────────────────────────────────────────────

export type BuilderStep =
  | "intro"
  | "params"       // step 1: age + budget + guests + theme
  | "place"        // step 2: format + venue selection
  | "entertainment" // step 3: animators / shows (optional)
  | "food"         // step 4: cakes / food (optional)
  | "decor"        // step 5: decor / addons (optional)
  | "summary"      // step 6: assembled party
  | "confirm";     // step 7: confirm which businesses to send requests to

export type BirthdayBuilderState = {
  currentStep: BuilderStep;
  inputs: BirthdayQuizInputs;
  selection: BirthdaySelection;
  /** Pending replacement: when user wants to swap a conflicted addon */
  pendingReplacement: string | null;
};

// ─── Candidates ──────────────────────────────────────────────────────────────

export type BirthdayCandidateGroup = {
  label: string;
  layer: OfferLayer;
  offers: BirthdayOffer[];
};

// ─── Request foundation ──────────────────────────────────────────────────────

export type RequestStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "EXPIRED";

export type BirthdayRequestTarget = {
  businessId: string;
  businessName: string;
  offerId: string;
  offerTitle: string;
  selected: boolean;
};

export type BirthdayRequest = {
  id: string;
  userId: string;
  targets: BirthdayRequestTarget[];
  status: RequestStatus;
  builderSnapshot: BirthdayBuilderState;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Legacy compat (used by old quiz, will be removed after full migration) ──
/** @deprecated use BirthdayBuilderState */
export type BirthdayQuizState = {
  currentStep: number;
  ageGroup: BirthdayAgeGroup | null;
  format: BirthdayFormatChoice | null;
  guestsGroup: BirthdayGuestsGroup | null;
  budgetGroup: BirthdayBudgetGroup | null;
  selectedOfferIds: string[];
};
