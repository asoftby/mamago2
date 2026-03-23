import type { UserBirthdayParty, UserBirthdayPartyStatus } from "../types/userBirthdayParty";

/** Короткие «человеческие» статусы для дашборда */
const STATUS_LABEL: Record<UserBirthdayPartyStatus, string> = {
  draft: "Черновик",
  awaiting: "⏳ Ждём ответы",
  partial: "🟡 Частично подтверждено",
  ready: "✅ Всё подтверждено",
  completed: "Завершён",
  archived: "В архиве",
};

/** Меньше = важнее в списке превью */
const STATUS_SORT: Record<UserBirthdayPartyStatus, number> = {
  draft: 0,
  awaiting: 1,
  partial: 2,
  ready: 3,
  completed: 10,
  archived: 11,
};

export function getPartyDisplayTitle(party: UserBirthdayParty): string {
  if (party.title?.trim()) return party.title.trim();
  return `Праздник ${party.childName}`;
}

/** Одна строка: название или имя ребёнка (без «Праздник …») */
export function getPartyNameLine(party: UserBirthdayParty): string {
  if (party.title?.trim()) return party.title.trim();
  return party.childName;
}

/** До 2 позиций через « + », одна строка */
export function getPartyShortSummary(party: UserBirthdayParty): string | null {
  if (!party.previewItems?.length) return null;
  const s = party.previewItems.slice(0, 2).join(" + ");
  if (s.length <= 52) return s;
  return `${s.slice(0, 49)}…`;
}

export function getPartyStatusLabel(status: UserBirthdayPartyStatus): string {
  return STATUS_LABEL[status] ?? status;
}

export function sortPartiesForProfile(parties: UserBirthdayParty[]): UserBirthdayParty[] {
  return [...parties].sort((a, b) => {
    const d = STATUS_SORT[a.status] - STATUS_SORT[b.status];
    if (d !== 0) return d;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

/** Для карточек: «12 мая • 15:00–17:00» */
export function formatPartyDateTimeCompact(party: UserBirthdayParty): string | null {
  if (!party.dateIso) return null;
  const d = new Date(`${party.dateIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const dateStr = d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
  if (party.timeStart && party.timeEnd) {
    return `${dateStr} • ${party.timeStart}–${party.timeEnd}`;
  }
  if (party.timeStart) {
    return `${dateStr} • ${party.timeStart}`;
  }
  return dateStr;
}

export function formatPartyDateTime(party: UserBirthdayParty): string | null {
  if (!party.dateIso) return null;
  const d = new Date(`${party.dateIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return party.dateIso;
  const dateStr = d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (party.timeStart && party.timeEnd) {
    return `${dateStr} • ${party.timeStart}–${party.timeEnd}`;
  }
  if (party.timeStart) {
    return `${dateStr} • с ${party.timeStart}`;
  }
  return dateStr;
}

/** Класс цвета строки статуса на карточке */
export function getPartyStatusToneClass(status: UserBirthdayPartyStatus): string {
  switch (status) {
    case "draft":
      return "text-neutral-500";
    case "awaiting":
      return "text-amber-800/90";
    case "partial":
      return "text-amber-700";
    case "ready":
      return "text-emerald-700";
    case "completed":
      return "text-neutral-500";
    case "archived":
      return "text-neutral-400";
    default:
      return "text-muted-foreground";
  }
}

export function getPartyCtaLabel(status: UserBirthdayPartyStatus): string {
  return status === "draft" ? "Продолжить" : "Открыть";
}

export type ConfirmationProgressUi = {
  showBar: boolean;
  fillPct: number;
  trackClass: string;
  fillClass: string;
  label: string;
  labelClass: string;
};

/**
 * Статус согласования: полоска + одна строка «Подтвердили X из Y» / «Все подтверждено».
 * Серый — 0%, оранжевый — в процессе, зелёный — 100%.
 */
export function getConfirmationProgressUi(party: UserBirthdayParty): ConfirmationProgressUi {
  if (party.status === "draft") {
    return {
      showBar: false,
      fillPct: 0,
      trackClass: "",
      fillClass: "",
      label: "Черновик",
      labelClass: "text-neutral-500",
    };
  }

  const total = party.confirmationTotal ?? 0;
  const confirmed = Math.min(
    Math.max(0, party.confirmationCount ?? 0),
    total > 0 ? total : 0,
  );

  if (total === 0) {
    return {
      showBar: true,
      fillPct: 0,
      trackClass: "bg-neutral-200/80",
      fillClass: "bg-neutral-400/90",
      label: "Подтверждения не указаны",
      labelClass: "text-neutral-500",
    };
  }

  const pct = Math.round((confirmed / total) * 100);
  const fillPct = Math.min(100, Math.max(0, pct));
  const countLabel = `Подтвердили ${confirmed} из ${total}`;

  if (confirmed >= total) {
    return {
      showBar: true,
      fillPct: 100,
      trackClass: "bg-emerald-100/90",
      fillClass: "bg-emerald-500",
      label: "Все подтверждено",
      labelClass: "text-emerald-800/90",
    };
  }

  if (confirmed === 0) {
    return {
      showBar: true,
      fillPct: 0,
      trackClass: "bg-neutral-200/80",
      fillClass: "bg-neutral-400/90",
      label: countLabel,
      labelClass: "text-neutral-500",
    };
  }

  return {
    showBar: true,
    fillPct,
    trackClass: "bg-orange-100/90",
    fillClass: "bg-[#EF8759]",
    label: countLabel,
    labelClass: "text-orange-900/85",
  };
}

export function takePreviewParties(
  parties: UserBirthdayParty[],
  max = 3,
): UserBirthdayParty[] {
  return sortPartiesForProfile(parties).slice(0, max);
}
