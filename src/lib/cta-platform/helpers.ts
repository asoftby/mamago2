import type { CtaContactFallback, CtaExternalTarget } from "./types";

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizePhoneValue(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

export function createUrlTarget(value: string): CtaExternalTarget | undefined {
  const normalized = value.trim();
  if (!normalized || !isHttpUrl(normalized)) return undefined;

  return {
    channel: "URL",
    value: normalized,
    href: normalized,
    openInNewTab: true,
  };
}

export function createPhoneTarget(value: string): CtaExternalTarget | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  const normalized = normalizePhoneValue(raw);
  if (!normalized) return undefined;

  return {
    channel: "PHONE",
    value: raw,
    href: `tel:${normalized}`,
    openInNewTab: false,
  };
}

export function createPhoneFallback(
  value: string,
  label?: string,
): CtaContactFallback | undefined {
  const target = createPhoneTarget(value);
  if (!target) return undefined;

  return {
    channel: "PHONE",
    value: target.value,
    href: target.href,
    label,
  };
}
