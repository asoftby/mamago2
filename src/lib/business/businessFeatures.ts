/**
 * Включаемые по бизнесу функции — `Business.features` (JSON).
 * Отсутствующий или невалидный ключ = выключено. Неизвестные ключи при чтении отбрасываются.
 */

import type { Prisma } from "@prisma/client";

export const BUSINESS_FEATURE_KEYS = ["newOfferWizard", "leadForm", "selections"] as const;

export type BusinessFeatureKey = (typeof BUSINESS_FEATURE_KEYS)[number];

export type BusinessFeatures = Record<BusinessFeatureKey, boolean>;

export const BUSINESS_FEATURE_LABELS: Record<
  BusinessFeatureKey,
  { title: string; description: string }
> = {
  newOfferWizard: {
    title: "Новый мастер предложений",
    description: "6 шагов вместо старого мастера. Выключение возвращает старый мастер.",
  },
  leadForm: {
    title: "Кнопка заявки",
    description: "Показывать родителям кнопку «Оставить заявку».",
  },
  selections: {
    title: "Участие в подборках",
    description: "Предложения бизнеса участвуют в подборках для семей.",
  },
};

export function isBusinessFeatureKey(value: unknown): value is BusinessFeatureKey {
  return typeof value === "string" && (BUSINESS_FEATURE_KEYS as readonly string[]).includes(value);
}

/** Привести сырое значение из БД к полному типизированному объекту. */
export function parseBusinessFeatures(raw: unknown): BusinessFeatures {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const result = {} as BusinessFeatures;
  for (const key of BUSINESS_FEATURE_KEYS) {
    result[key] = source[key] === true;
  }
  return result;
}

export function isBusinessFeatureEnabled(
  business: { features?: unknown } | null | undefined,
  key: BusinessFeatureKey,
): boolean {
  return parseBusinessFeatures(business?.features)[key];
}

/**
 * Применить частичное обновление к сырому JSON. Ключи, которых нет в patch,
 * и неизвестные ключи сохраняются как были.
 */
export function mergeBusinessFeatures(
  raw: unknown,
  patch: Partial<Record<BusinessFeatureKey, boolean>>,
): Prisma.InputJsonObject {
  const base: Record<string, Prisma.InputJsonValue> =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, Prisma.InputJsonValue>) }
      : {};
  for (const key of BUSINESS_FEATURE_KEYS) {
    if (typeof patch[key] === "boolean") base[key] = patch[key];
  }
  return base;
}

/** Валидировать тело запроса: только известные ключи с boolean, минимум один. */
export function parseBusinessFeaturesPatch(
  body: unknown,
): Partial<Record<BusinessFeatureKey, boolean>> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const patch: Partial<Record<BusinessFeatureKey, boolean>> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (!isBusinessFeatureKey(key) || typeof value !== "boolean") return null;
    patch[key] = value;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}
