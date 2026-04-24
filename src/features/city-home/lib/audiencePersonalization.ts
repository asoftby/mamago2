import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
import { firstNameGenitiveForDlya } from "@/features/birthday/builder/lib/russianFirstNameGenitive";

function firstToken(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

function capitalizeLike(original: string, declinedLower: string): string {
  if (!declinedLower.length) return declinedLower;
  const o0 = original[0];
  if (o0 && o0 === o0.toUpperCase() && o0 !== o0.toLowerCase()) {
    return declinedLower.charAt(0).toUpperCase() + declinedLower.slice(1);
  }
  return declinedLower;
}

function toInstrumentalName(name: string): string {
  const first = firstToken(name);
  if (!first) return "";

  const lower = first.toLowerCase();

  const SPECIAL: Record<string, string> = {
    илья: "ильёй",
    лев: "львом",
    павел: "павлом",
    пётр: "петром",
    петр: "петром",
  };

  if (SPECIAL[lower]) {
    return capitalizeLike(first, SPECIAL[lower]);
  }

  if (lower.endsWith("ия")) {
    return capitalizeLike(first, lower.slice(0, -2) + "ией");
  }
  if (lower.endsWith("ья")) {
    return capitalizeLike(first, lower.slice(0, -2) + "ьей");
  }
  if (lower.endsWith("ей")) {
    return capitalizeLike(first, lower.slice(0, -2) + "еем");
  }
  if (lower.endsWith("ий")) {
    return capitalizeLike(first, lower.slice(0, -2) + "ием");
  }
  if (lower.endsWith("й")) {
    return capitalizeLike(first, lower.slice(0, -1) + "ем");
  }
  if (lower.endsWith("я")) {
    return capitalizeLike(first, lower.slice(0, -1) + "ей");
  }
  if (lower.endsWith("а")) {
    const before = lower[lower.length - 2] ?? "";
    const suffix = "жчшщц".includes(before) ? "ей" : "ой";
    return capitalizeLike(first, lower.slice(0, -1) + suffix);
  }
  if (lower.endsWith("ь")) {
    return capitalizeLike(first, lower.slice(0, -1) + "ью");
  }
  if (/[жчшщц]$/i.test(lower)) {
    return capitalizeLike(first, lower + "ем");
  }
  return capitalizeLike(first, lower + "ом");
}

function selectedAudiencePersonas(
  selectedPersonaIds: string[],
  personas: FamilyPersona[],
): FamilyPersona[] {
  return personas.filter(
    (persona) =>
      selectedPersonaIds.includes(persona.id) &&
      (persona.kind === "child" || persona.isProfileComplete === true),
  );
}

export function buildAudienceLabel(params: {
  selectedPersonaIds: string[];
  personas: FamilyPersona[];
}): string {
  const selected = selectedAudiencePersonas(params.selectedPersonaIds, params.personas);
  if (selected.length === 0) return "";

  const adults = selected.filter((p) => p.kind === "adult");
  const children = selected.filter((p) => p.kind === "child");

  if (adults.length > 0 && children.length > 0) {
    return "для семьи";
  }

  if (adults.length === 1 && children.length === 0) {
    const name = adults[0]?.displayName?.trim();
    if (!name) return "";
    return `для ${firstNameGenitiveForDlya(name)}`;
  }

  if (children.length === 1) {
    const name = children[0]?.displayName?.trim();
    if (!name) return "";
    return `со ${toInstrumentalName(name)}`;
  }

  if (children.length === 2) {
    const first = children[0]?.displayName?.trim();
    const second = children[1]?.displayName?.trim();
    if (!first || !second) return "с детьми";
    return `с ${toInstrumentalName(first)} и ${toInstrumentalName(second)}`;
  }

  if (children.length > 2) {
    return "с детьми";
  }

  return "";
}

export function buildAudienceSubtitle(params: {
  selectedPersonaIds: string[];
  personas: FamilyPersona[];
}): string | null {
  const selected = selectedAudiencePersonas(params.selectedPersonaIds, params.personas);
  if (selected.length === 0) return null;

  const adults = selected.filter((p) => p.kind === "adult");
  const children = selected.filter((p) => p.kind === "child");

  if (adults.length > 0 && children.length > 0) {
    return "Подборка для всей семьи";
  }

  if (children.length === 1) {
    const name = children[0]?.displayName?.trim();
    return name ? `Подходит для ${name}` : "Подходит для ребёнка";
  }

  if (children.length >= 2) {
    return "Подходит для выбранных детей";
  }

  if (adults.length === 1) {
    const name = adults[0]?.displayName?.trim();
    return name ? `Подходит для ${name}` : "Подходит для вас";
  }

  return null;
}

export function buildMainTitle(input: {
  baseTitle: string;
  audienceLabel: string;
}): string {
  return input.audienceLabel ? `${input.baseTitle} ${input.audienceLabel}` : input.baseTitle;
}
