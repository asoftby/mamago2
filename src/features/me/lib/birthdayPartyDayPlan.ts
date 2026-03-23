import type {
  OrganizerConfirmationStatus,
  ScenarioSlotKey,
  UserBirthdayPartyOrganizer,
} from "@/features/me/types/userBirthdayParty";

const SLOT_ORDER: ScenarioSlotKey[] = [
  "place",
  "animator",
  "decor",
  "cake",
  "photo",
  "masterclass",
  "food",
  "games",
  "other",
];

/** «15:30» → минуты от полуночи; невалидно → null */
export function parseTimeLabelToMinutes(label: string | undefined | null): number | null {
  if (!label) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(label.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Сортировка таймлайна: время → слот → заголовок */
export function sortOrganizersByTimeline(
  organizers: UserBirthdayPartyOrganizer[],
): UserBirthdayPartyOrganizer[] {
  return [...organizers].sort((a, b) => {
    const ma = parseTimeLabelToMinutes(a.timeLabel);
    const mb = parseTimeLabelToMinutes(b.timeLabel);
    if (ma != null && mb != null && ma !== mb) return ma - mb;
    if (ma != null && mb == null) return -1;
    if (ma == null && mb != null) return 1;
    const ia = SLOT_ORDER.indexOf(a.roleSlot);
    const ib = SLOT_ORDER.indexOf(b.roleSlot);
    const sa = ia === -1 ? 999 : ia;
    const sb = ib === -1 ? 999 : ib;
    if (sa !== sb) return sa - sb;
    return a.roleTitle.localeCompare(b.roleTitle, "ru");
  });
}

export function getOrganizerTelHref(o: UserBirthdayPartyOrganizer): string | null {
  const c = o.contacts?.find((x) => x.href.trim().toLowerCase().startsWith("tel:"));
  return c?.href ?? null;
}

/** Чат / диалог Mamago или первый внешний контакт для «Открыть диалог» */
export function getOrganizerDialogHref(o: UserBirthdayPartyOrganizer): string | null {
  const chat = o.contacts?.find(
    (x) =>
      x.kind === "chat" ||
      x.href.includes("mamago.app/chat") ||
      x.href.includes("/chat"),
  );
  if (chat) return chat.href;
  const http = o.contacts?.find((x) => x.href.startsWith("http"));
  return http?.href ?? null;
}

export function shouldShowCallButton(status: OrganizerConfirmationStatus): boolean {
  return status === "confirmed";
}

export function shouldShowDialogButton(status: OrganizerConfirmationStatus): boolean {
  return status === "messaged";
}
