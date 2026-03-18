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

export type BirthdayOffer = {
  id: string;
  title: string;
  type: BirthdayOfferType;
  category: BirthdayOfferCategory;
  city: string;
  district?: string;
  ageMin?: number;
  ageMax?: number;
  guestsMin?: number;
  guestsMax?: number;
  priceFrom?: number;
  priceTo?: number;
  currency: "BYN";
  formatTags?: BirthdayFormat[];
  image: string;
  shortDescription?: string;
  businessName?: string;
  rating?: number;
  reviewCount?: number;
  isFeatured?: boolean;
};

// ─── Quiz state ──────────────────────────────────────────────────────────────

export type BirthdayAgeGroup = "0-3" | "3-5" | "5-8" | "8-12";
export type BirthdayGuestsGroup = "up5" | "5-10" | "10-15" | "15plus";
export type BirthdayBudgetGroup = "up300" | "300-600" | "600-1000" | "1000plus" | "unknown";
export type BirthdayFormatChoice = "HOME" | "VENUE" | "OUTDOOR" | "unknown";

export type BirthdayQuizState = {
  currentStep: number;
  ageGroup: BirthdayAgeGroup | null;
  format: BirthdayFormatChoice | null;
  guestsGroup: BirthdayGuestsGroup | null;
  budgetGroup: BirthdayBudgetGroup | null;
  selectedOfferIds: string[];
};

export type BirthdayCandidateGroup = {
  label: string;
  offers: BirthdayOffer[];
};

// ─── Request foundation ──────────────────────────────────────────────────────

export type RequestStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "EXPIRED";

export type BirthdayRequest = {
  id: string;
  userId: string;
  offerId: string;
  businessId: string;
  status: RequestStatus;
  quizSnapshot: BirthdayQuizState;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
};
