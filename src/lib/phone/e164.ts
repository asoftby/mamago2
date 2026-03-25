import {
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

import { preNormalizeBelarusLocal } from "./belarus";

/**
 * Best-effort parse to E.164 for legacy drafts / API strings.
 * Сначала белорусская pre-normalization (80… / 375…), затем libphonenumber.
 */
export function normalizePhoneToE164(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const byPre = preNormalizeBelarusLocal(trimmed);
  const candidates = [
    byPre,
    byPre.replace(/\s/g, ""),
    trimmed,
    trimmed.replace(/\s/g, ""),
    trimmed.startsWith("+") ? trimmed : `+${trimmed.replace(/^\+/g, "")}`,
  ];

  const seen = new Set<string>();
  for (const c of candidates) {
    if (!c || seen.has(c)) continue;
    seen.add(c);
    const intl = parsePhoneNumberFromString(c);
    if (intl?.isValid()) {
      return intl.format("E.164");
    }
    const by = parsePhoneNumberFromString(c, "BY");
    if (by?.isValid()) {
      return by.format("E.164");
    }
  }

  return byPre || trimmed;
}

/**
 * Разбор сырого текста из инпута (в т.ч. после paste/blur) в E.164.
 * Для BY применяется preNormalizeBelarusLocal; страна влияет на парсинг национального формата.
 */
export function resolvePhoneInputToE164(raw: string, country: CountryCode): string | null {
  const t = raw.trim();
  if (!t) return null;

  const pre = country === "BY" ? preNormalizeBelarusLocal(t) : t;
  const candidates = pre !== t ? [pre, t] : [pre];

  const seen = new Set<string>();
  for (const c of candidates) {
    if (!c || seen.has(c)) continue;
    seen.add(c);
    const p = parsePhoneNumberFromString(c, country) ?? parsePhoneNumberFromString(c);
    if (p?.isValid()) {
      return p.format("E.164");
    }
  }

  return null;
}

export function isValidE164Phone(phone: string): boolean {
  const normalized = normalizePhoneToE164(phone);
  if (!normalized) return false;
  return isValidPhoneNumber(normalized);
}
