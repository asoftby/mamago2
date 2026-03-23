import type { UserBirthdayPartyOrganizer } from "@/features/me/types/userBirthdayParty";
import {
  getOrganizerTelHref,
  sortOrganizersByTimeline,
} from "@/features/me/lib/birthdayPartyDayPlan";

/** Человекочитаемый номер из tel: для шаринга */
export function formatTelForShare(telHref: string): string {
  const h = telHref.trim();
  if (!h.toLowerCase().startsWith("tel:")) return h;
  try {
    const raw = decodeURIComponent(h.slice(4).replace(/\s/g, ""));
    return raw || telHref;
  } catch {
    return h.replace(/^tel:/i, "");
  }
}

export function buildBirthdayPartyShareText(params: {
  partyTitle: string;
  dateTimeLine: string | null;
  organizers: UserBirthdayPartyOrganizer[];
}): string {
  const sorted = sortOrganizersByTimeline(params.organizers);
  const lines: string[] = [];

  lines.push(`Праздник ${params.partyTitle} 🎉`);
  lines.push(params.dateTimeLine ?? "Дата и время уточняются");
  lines.push("");
  lines.push("План:");
  lines.push("");

  for (const o of sorted) {
    const time = o.timeLabel?.trim() || "—";
    lines.push(`${time} — ${o.roleTitle}`);
    lines.push(o.businessName);
    const tel = getOrganizerTelHref(o);
    if (tel) {
      lines.push(`📞 ${formatTelForShare(tel)}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/**
 * Добавляет ссылку один раз в конце (не в начале сообщения).
 * Формат: пустая строка, затем «Смотреть план:» и URL с новой строки.
 */
export function appendSharePlanLinkFooter(planText: string, absoluteUrl: string): string {
  const url = absoluteUrl.trim();
  if (!url) return planText.trimEnd();
  return `${planText.trimEnd()}\n\nСмотреть план:\n${url}`;
}

export function buildPublicPlanPath(partyId: string): string {
  return `/p/${partyId}`;
}
