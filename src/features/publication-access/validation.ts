import type { PublicationAccess } from "./types";

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function validatePublicationAccess(access: PublicationAccess): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!access.method) {
    errors.method = "Выберите способ доступа";
  }

  if (access.method === "ticket") {
    if (!access.ticketUrl?.trim()) {
      errors.ticketUrl = "Укажите ссылку на билет";
    } else if (!isValidUrl(access.ticketUrl)) {
      errors.ticketUrl = "Некорректная ссылка";
    }
  }

  if (access.method === "external") {
    if (!access.externalUrl?.trim()) {
      errors.externalUrl = "Укажите ссылку";
    } else if (!isValidUrl(access.externalUrl)) {
      errors.externalUrl = "Некорректная ссылка";
    }
  }

  if (access.method === "timeslots") {
    if (!access.timeSlots || access.timeSlots.length === 0) {
      errors.timeSlots = "Добавьте хотя бы один слот";
    }
  }

  if (access.method === "contact") {
    if (!access.phone?.trim() && !access.instructions?.trim()) {
      errors.contact = "Укажите телефон или инструкции";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

