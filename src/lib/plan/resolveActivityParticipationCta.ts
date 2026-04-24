import { publicActivityPath } from "@/lib/business/eventPublicLink";
import type { PlanItemWithActivity } from "@/server/services/plan.service";

type ActivityForCta = NonNullable<PlanItemWithActivity["activity"]>;

function readScheduleJson(raw: unknown): {
  participationMode?: string;
  ticketLink?: string;
  prebookMethod?: string;
  prebookPhone?: string;
  prebookUrl?: string;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    participationMode:
      typeof o.participationMode === "string" ? o.participationMode : undefined,
    ticketLink: typeof o.ticketLink === "string" ? o.ticketLink : undefined,
    prebookMethod: typeof o.prebookMethod === "string" ? o.prebookMethod : undefined,
    prebookPhone: typeof o.prebookPhone === "string" ? o.prebookPhone : undefined,
    prebookUrl: typeof o.prebookUrl === "string" ? o.prebookUrl : undefined,
  };
}

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

export type ActivityParticipationCta = {
  label: string;
  href: string;
  external: boolean;
};

/**
 * CTA «Купить билет» / «Записаться» / «Выбрать время» из scheduleJson активности.
 */
export function resolveActivityParticipationCta(
  activity: ActivityForCta,
  citySlug: string,
): ActivityParticipationCta | null {
  const sj = readScheduleJson(activity.scheduleJson);
  if (!sj?.participationMode) return null;

  const mode = sj.participationMode;
  const ticketLink = (sj.ticketLink ?? "").trim();
  const prebookUrl = (sj.prebookUrl ?? "").trim();
  const prebookPhone = (sj.prebookPhone ?? "").trim();

  if (mode === "external-link" && ticketLink && isHttpUrl(ticketLink)) {
    return { label: "Купить билет", href: ticketLink, external: true };
  }

  if (mode === "prebook") {
    if (sj.prebookMethod === "link" && prebookUrl && isHttpUrl(prebookUrl)) {
      return { label: "Записаться", href: prebookUrl, external: true };
    }
    if (sj.prebookMethod === "phone" && prebookPhone) {
      const telHref = `tel:${prebookPhone.replace(/[^\d+]/g, "")}`;
      return { label: "Записаться", href: telHref, external: true };
    }
  }

  const href = publicActivityPath(activity.id, citySlug, activity.slug);

  if (mode === "simple-booking") {
    return {
      label: "Записаться",
      href,
      external: false,
    };
  }

  if (mode === "time-slots") {
    return {
      label: "Выбрать время",
      href,
      external: false,
    };
  }

  return null;
}
