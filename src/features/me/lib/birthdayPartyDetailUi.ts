import type { OrganizerConfirmationStatus } from "@/features/me/types/userBirthdayParty";

export function getOrganizerStatusLabel(
  status: OrganizerConfirmationStatus,
): string {
  switch (status) {
    case "pending":
    case "awaiting":
      return "Ждём ответ";
    case "confirmed":
      return "Подтверждено";
    case "declined":
      return "Не могут";
    case "messaged":
      return "Написали";
    default:
      return String(status);
  }
}

export function getOrganizerStatusToneClass(
  status: OrganizerConfirmationStatus,
): string {
  switch (status) {
    case "confirmed":
      return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80";
    case "declined":
      return "bg-red-50 text-red-800 ring-1 ring-red-200/70";
    case "messaged":
      return "bg-sky-50 text-sky-900 ring-1 ring-sky-200/80";
    case "pending":
    case "awaiting":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80";
    default:
      return "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200/80";
  }
}
