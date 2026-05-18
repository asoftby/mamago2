import type { OfferFormData } from "./types";

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\d\s\+\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, "").length >= 9;
}

export function isOfferManualContactsValid(data: OfferFormData): boolean {
  if (data.phone && !isValidPhone(data.phone)) return false;
  if (data.website && !isValidUrl(data.website)) return false;

  return data.socialLinks.every((link) => {
    if (!link.url || link.url.trim().length === 0) return false;
    return isValidUrl(link.url);
  });
}

export function isOfferContactsComplete(data: OfferFormData): boolean {
  if (data.contactSource === "place") {
    return Boolean(data.placeId);
  }

  return isOfferManualContactsValid(data);
}

export { isValidPhone, isValidUrl };
