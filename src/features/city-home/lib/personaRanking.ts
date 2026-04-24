import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
import type { ActivityMock } from "@/mocks/activity.types";

type PersonaRankingInput = {
  personas: FamilyPersona[];
  selectedPersonaIds: string[];
};

type SelectedPersonaSummary = {
  selected: FamilyPersona[];
  children: FamilyPersona[];
  adults: FamilyPersona[];
};

const FAMILY_KEYWORDS = [
  "family",
  "kids",
  "child",
  "children",
  "дет",
  "семе",
  "семей",
  "подрост",
  "школ",
];

const ADULT_KEYWORDS = [
  "adult",
  "взросл",
  "мастер-класс",
  "дегустац",
  "ужин",
  "стендап",
  "концерт",
  "лекци",
  "выставк",
  "театр",
  "ресторан",
  "spa",
];

function getActivityText(activity: ActivityMock): string {
  return [
    activity.title,
    activity.description,
    activity.badge,
    activity.ageHintBadge,
    activity.geoBadge,
    activity.discoveryIntent,
    ...(activity.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function getSelectedPersonaSummary(input: PersonaRankingInput): SelectedPersonaSummary {
  const selected =
    input.selectedPersonaIds.length === 0
      ? []
      : input.personas.filter((persona) => input.selectedPersonaIds.includes(persona.id));

  return {
    selected,
    children: selected.filter((persona) => persona.kind === "child"),
    adults: selected.filter((persona) => persona.kind === "adult"),
  };
}

function getAgeFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) {
    return null;
  }

  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const hasBirthdayPassed =
    now.getMonth() > date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate());

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export function getAgeScore(activity: ActivityMock, personas: FamilyPersona[]): number {
  const children = personas.filter((persona) => persona.kind === "child");
  if (children.length === 0) {
    return 0;
  }

  const ageMin = Number.isFinite(activity.ageFrom) ? activity.ageFrom : null;
  const ageMax = Number.isFinite(activity.ageTo) ? activity.ageTo : null;

  if (ageMin == null || ageMax == null) {
    return 0;
  }

  let bestScore = 0;

  for (const child of children) {
    const age = getAgeFromBirthDate(child.birthDate);
    if (age == null) {
      continue;
    }

    if (age >= ageMin && age <= ageMax) {
      bestScore = Math.max(bestScore, 30);
      continue;
    }

    const distance = Math.min(Math.abs(age - ageMin), Math.abs(age - ageMax));
    if (distance <= 2) {
      bestScore = Math.max(bestScore, 10);
      continue;
    }

    bestScore = Math.max(bestScore, -10);
  }

  return bestScore;
}

export function getPersonaBoost(activity: ActivityMock, personas: FamilyPersona[]): number {
  const children = personas.filter((persona) => persona.kind === "child");
  const adults = personas.filter((persona) => persona.kind === "adult");

  if (children.length === 0 && adults.length === 0) {
    return 0;
  }

  const text = getActivityText(activity);
  const isFamilyFriendly = includesAny(text, FAMILY_KEYWORDS);
  const isAdultFriendly = includesAny(text, ADULT_KEYWORDS);
  const hasBroadAgeRange = activity.ageTo >= 12 || activity.ageFrom === 0;
  const hasStrictKidRange = activity.ageTo <= 12;

  if (adults.length > 0 && children.length > 0) {
    let boost = 0;
    if (isFamilyFriendly) {
      boost += 18;
    }
    if (hasBroadAgeRange) {
      boost += 6;
    }
    if (isAdultFriendly && isFamilyFriendly) {
      boost += 4;
    }
    return boost;
  }

  if (adults.length > 0 && children.length === 0) {
    let boost = 0;
    if (isAdultFriendly) {
      boost += 16;
    }
    if (activity.ageFrom >= 12 || activity.ageTo >= 16) {
      boost += 8;
    }
    if (!hasStrictKidRange) {
      boost += 4;
    }
    return boost;
  }

  let boost = 0;
  if (isFamilyFriendly) {
    boost += 10;
  }
  if (hasStrictKidRange) {
    boost += 6;
  }
  if (children.length > 1 && isFamilyFriendly) {
    boost += 6;
  }
  return boost;
}

export function applyPersonaRanking(
  activities: ActivityMock[],
  input: PersonaRankingInput,
): ActivityMock[] {
  const personaSummary = getSelectedPersonaSummary(input);
  if (personaSummary.selected.length === 0) {
    return activities;
  }

  return activities
    .map((activity, index) => {
      const baseScore = (activities.length - index) * 100 + (activity.engagementScore ?? 0);
      const ageScore = getAgeScore(activity, personaSummary.children);
      const personaBoost = getPersonaBoost(activity, personaSummary.selected);
      const finalScore = baseScore + ageScore + personaBoost;

      return {
        activity,
        index,
        finalScore,
      };
    })
    .sort((left, right) => {
      if (right.finalScore !== left.finalScore) {
        return right.finalScore - left.finalScore;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.activity);
}
