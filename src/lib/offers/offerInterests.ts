import { SYSTEM_INTERESTS } from "@/lib/config/interests";

/** Максимум интересов на предложение. */
export const MAX_OFFER_INTERESTS = 5;

const KNOWN_SLUGS: ReadonlySet<string> = new Set(SYSTEM_INTERESTS.map((interest) => interest.slug));

export type InterestSlugsCheck =
  | { ok: true; slugs: string[] }
  | { ok: false; reason: "TOO_MANY" | "INVALID" };

/**
 * Интересы предложения = справочник интересов профиля ребёнка (`SYSTEM_INTERESTS`).
 * Неизвестные slug отклоняются, дубли схлопываются, порядок выбора сохраняется, не больше 5.
 */
export function checkInterestSlugs(value: unknown): InterestSlugsCheck {
  if (!Array.isArray(value)) return { ok: false, reason: "INVALID" };
  const slugs: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !KNOWN_SLUGS.has(item)) return { ok: false, reason: "INVALID" };
    if (!slugs.includes(item)) slugs.push(item);
  }
  if (slugs.length > MAX_OFFER_INTERESTS) return { ok: false, reason: "TOO_MANY" };
  return { ok: true, slugs };
}
