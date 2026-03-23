import type {
  BirthdayOffer,
  BirthdayAgeGroup,
  BirthdayFormatChoice,
  BirthdayGuestsGroup,
  BirthdayBudgetGroup,
} from "../types/birthday";

// Age group → [min, max] years
const AGE_RANGES: Record<BirthdayAgeGroup, [number, number]> = {
  "0-3": [0, 3],
  "3-5": [3, 5],
  "5-8": [5, 8],
  "8-12": [8, 12],
};

// Guests group → [min, max]
const GUESTS_RANGES: Record<BirthdayGuestsGroup, [number, number]> = {
  up5: [1, 5],
  "5-10": [5, 10],
  "10-15": [10, 15],
  "15plus": [15, 999],
};

// Budget group → max price (soft ceiling)
const BUDGET_MAX: Record<BirthdayBudgetGroup, number> = {
  up300: 300,
  "300-600": 600,
  "600-1000": 1000,
  "1000plus": 99999,
  unknown: 99999,
};

export function filterBirthdayOffers(
  offers: BirthdayOffer[],
  params: {
    ageGroup?: BirthdayAgeGroup | null;
    format?: BirthdayFormatChoice | null;
    guestsGroup?: BirthdayGuestsGroup | null;
    budgetGroup?: BirthdayBudgetGroup | null;
  }
): BirthdayOffer[] {
  return offers.filter((offer) => {
    // Age filter — soft: if offer has no age range, pass
    if (params.ageGroup) {
      const [ageMin, ageMax] = AGE_RANGES[params.ageGroup];
      if (offer.ageMin !== undefined && offer.ageMax !== undefined) {
        // Overlap check
        if (offer.ageMax < ageMin || offer.ageMin > ageMax) return false;
      }
    }

    // Format filter — soft: UNKNOWN passes all
    if (params.format && params.format !== "unknown") {
      if (offer.formatTags && offer.formatTags.length > 0) {
        if (!offer.formatTags.includes(params.format as "HOME" | "VENUE" | "OUTDOOR")) {
          return false;
        }
      }
    }

    // Guests filter — soft
    if (params.guestsGroup) {
      const [gMin, gMax] = GUESTS_RANGES[params.guestsGroup];
      if (offer.guestsMin !== undefined && offer.guestsMax !== undefined) {
        if (offer.guestsMax < gMin || offer.guestsMin > gMax) return false;
      }
    }

    // Budget filter — soft: unknown passes all; otherwise allow ±20% tolerance
    if (params.budgetGroup && params.budgetGroup !== "unknown") {
      const maxBudget = BUDGET_MAX[params.budgetGroup];
      if (offer.priceFrom !== undefined) {
        // Allow offers up to 20% over budget (soft ceiling)
        if (offer.priceFrom > maxBudget * 1.2) return false;
      }
    }

    return true;
  });
}
