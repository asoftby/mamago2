import { pluralRu } from "@/lib/text/pluralRu";

/** Compact age display for public discovery cards. Bounds are expressed in years. */
export function formatCardAge(ageFrom: number | null | undefined, ageTo: number | null | undefined): string | undefined {
  if (ageFrom == null || !Number.isFinite(ageFrom) || ageFrom < 0) return undefined;
  if (ageTo == null || !Number.isFinite(ageTo) || ageTo >= 18) return `${ageFrom}+`;
  if (ageTo < ageFrom) return undefined;
  const unit = pluralRu(ageTo, "год", "года", "лет");
  return `${ageFrom}–${ageTo} ${unit}`;
}
