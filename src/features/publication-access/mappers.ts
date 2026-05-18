import {
  getDefaultPublicationAccess,
} from "./defaults";
import type {
  PublicationAccess,
  PublicationAccessMethod,
  PublicationAccessTimeSlot,
} from "./types";

function normalizeMethod(value: unknown): PublicationAccessMethod | undefined {
  if (
    value === "details" ||
    value === "ticket" ||
    value === "timeslots" ||
    value === "prebooking" ||
    value === "external" ||
    value === "contact"
  ) {
    return value;
  }
  return undefined;
}

function normalizeTimeSlot(input: unknown): PublicationAccessTimeSlot | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  if (typeof record.id !== "string") return null;
  if (typeof record.date !== "string") return null;
  if (typeof record.startTime !== "string") return null;

  return {
    id: record.id,
    date: record.date,
    startTime: record.startTime,
    endTime: typeof record.endTime === "string" ? record.endTime : undefined,
    capacity:
      typeof record.capacity === "number" ? record.capacity : null,
  };
}

export function normalizePublicationAccess(
  input: unknown,
): PublicationAccess {
  const fallback = getDefaultPublicationAccess("event");
  if (!input || typeof input !== "object") return fallback;

  const record = input as Record<string, unknown>;
  const method = normalizeMethod(record.method) ?? fallback.method;
  const timeSlots = Array.isArray(record.timeSlots)
    ? record.timeSlots
        .map(normalizeTimeSlot)
        .filter((slot): slot is PublicationAccessTimeSlot => slot !== null)
    : [];

  return {
    method,
    ticketUrl: typeof record.ticketUrl === "string" ? record.ticketUrl : undefined,
    externalUrl:
      typeof record.externalUrl === "string" ? record.externalUrl : undefined,
    phone: typeof record.phone === "string" ? record.phone : undefined,
    instructions:
      typeof record.instructions === "string" ? record.instructions : undefined,
    timeSlots,
  };
}

export function publicationAccessToApiPayload(
  access: PublicationAccess,
): unknown {
  return {
    method: access.method,
    ticketUrl: access.ticketUrl?.trim() || undefined,
    externalUrl: access.externalUrl?.trim() || undefined,
    phone: access.phone?.trim() || undefined,
    instructions: access.instructions?.trim() || undefined,
    timeSlots: access.timeSlots?.map((slot) => ({
      id: slot.id,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime || undefined,
      capacity: slot.capacity ?? null,
    })),
  };
}

export function apiPayloadToPublicationAccess(
  input: unknown,
): PublicationAccess {
  return normalizePublicationAccess(input);
}

