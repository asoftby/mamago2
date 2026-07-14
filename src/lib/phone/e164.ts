import {
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/core";
import metadataImport from "libphonenumber-js/metadata.max.json";

import { preNormalizeBelarusLocal } from "./belarus";

/**
 * `libphonenumber-js/core` + explicit metadata (instead of the full
 * `libphonenumber-js` package) — smaller bundle, and this metadata object
 * is also what makes this module safe to use from Node/migration code
 * without pulling in the full package's browser-oriented defaults.
 * `"default" in metadataImport` guards against the CJS/ESM interop shape
 * differing between bundler and `tsx`/Node's module resolution.
 */
const metadata = ("default" in metadataImport ? metadataImport.default : metadataImport) as typeof metadataImport;

/**
 * Best-effort parse to E.164 for legacy drafts / API strings — this is the
 * one canonical phone normalizer in the project; `phoneNormalize.ts`
 * re-exports this function rather than maintaining a second implementation.
 * Сначала белорусская pre-normalization (80… / 375…), затем libphonenumber.
 * Invalid/ambiguous input is never passed through verbatim — returns `""`
 * rather than a garbage "looks like E.164 but isn't" string, so callers
 * can treat an empty result as "needs a real value", not silently accept
 * unparseable text.
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
    const intl = parsePhoneNumberFromString(c, metadata);
    if (intl?.isValid()) {
      return intl.format("E.164");
    }
    const by = parsePhoneNumberFromString(c, "BY", metadata);
    if (by?.isValid()) {
      return by.format("E.164");
    }
  }

  return "";
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
    const p =
      parsePhoneNumberFromString(c, country, metadata) ?? parsePhoneNumberFromString(c, metadata);
    if (p?.isValid()) {
      return p.format("E.164");
    }
  }

  return null;
}

export function isValidE164Phone(phone: string): boolean {
  const normalized = normalizePhoneToE164(phone);
  if (!normalized) return false;
  return isValidPhoneNumber(normalized, metadata);
}
