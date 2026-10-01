import { ageYearsAt, childDisplayName } from "@/lib/child/birth";
import { formatYearsRu } from "./partyChildUtils";
import type { PartyForChild } from "../types/builder";

export type ProfileChildPayload = {
  id: string;
  name: string | null;
  birthDate: string;
  birthPrecision: "DAY" | "MONTH" | null;
  systemInterests?: { interestSlug: string }[];
};

export function profileChildAgeYears(child: ProfileChildPayload, now = new Date()): number | null {
  return ageYearsAt({ birthDate: child.birthDate, birthPrecision: child.birthPrecision }, now);
}

export function profileChildLabel(child: ProfileChildPayload, now = new Date()): string {
  const years = profileChildAgeYears(child, now);
  return `${childDisplayName(child.name)}${years == null ? "" : ` — ${formatYearsRu(years)}`}`;
}

export function profileChildCanApplyDirectly(child: ProfileChildPayload): boolean {
  return child.birthPrecision === "DAY";
}

export function exactProfileChildToParty(child: ProfileChildPayload, now = new Date()): PartyForChild {
  if (!profileChildCanApplyDirectly(child)) {
    throw new Error("Требуется полная дата рождения");
  }
  const years = profileChildAgeYears(child, now);
  if (years == null) throw new Error("Некорректная дата рождения");
  return {
    profileChildId: child.id,
    name: childDisplayName(child.name),
    ageLabel: formatYearsRu(years),
    birthDateIso: child.birthDate.slice(0, 10),
    interestSlugs: child.systemInterests?.map((item) => item.interestSlug).filter(Boolean) ?? [],
  };
}
