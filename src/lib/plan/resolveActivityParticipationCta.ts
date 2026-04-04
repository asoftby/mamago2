import { publicActivityPath } from "@/lib/business/eventPublicLink";
import type { PlanItemWithActivity } from "@/server/services/plan.service";

type ActivityForCta = NonNullable<PlanItemWithActivity["activity"]>;

function readScheduleJson(raw: unknown): {
  participationMode?: string;
  ticketLink?: string;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    participationMode:
      typeof o.participationMode === "string" ? o.participationMode : undefined,
    ticketLink: typeof o.ticketLink === "string" ? o.ticketLink : undefined,
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

  if (mode === "external-link" && ticketLink && isHttpUrl(ticketLink)) {
    return { label: "Купить билет", href: ticketLink, external: true };
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
