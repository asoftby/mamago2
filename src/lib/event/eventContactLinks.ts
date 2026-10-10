import type { ActivityForEventPageInput } from "./buildEventPageDataFromPrisma";
import type { EventPageCtaConfig } from "./eventPageTypes";

/** Event wizard contacts (step 7), with explicit Place inheritance when chosen. */
export function resolveEventContactLinks(
  activity: Pick<ActivityForEventPageInput, "scheduleJson" | "place" | "venue">,
): Pick<EventPageCtaConfig, "website" | "socialLinks"> {
  const schedule = activity.scheduleJson;
  const value = schedule && typeof schedule === "object" && !Array.isArray(schedule)
    ? (schedule as Record<string, unknown>).contacts : null;
  const contacts = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
  const place = activity.place ?? activity.venue?.place ?? null;
  const inherit = contacts?.mode === "inherit";

  const httpLink = (raw: unknown, network?: string): string | undefined => {
    if (typeof raw !== "string") return undefined;
    const str = raw.trim();
    if (!str) return undefined;
    const candidate = str.startsWith("@") && network === "instagram"
      ? `https://instagram.com/${str.slice(1)}`
      : str.startsWith("@") && network === "telegram"
        ? `https://t.me/${str.slice(1)}`
        : /^https?:\/\//i.test(str) ? str : `https://${str}`;
    try {
      const url = new URL(candidate);
      return /^https?:$/.test(url.protocol) && url.hostname.includes(".") ? url.href : undefined;
    } catch {
      return undefined;
    }
  };

  const websiteHref = httpLink(inherit
    ? place?.website ?? contacts?.website
    : contacts?.website ?? (!contacts ? place?.website : null));
  const website = websiteHref
    ? { href: websiteHref, value: websiteHref.replace(/^https?:\/\//i, "").replace(/\/$/, "") }
    : undefined;

  const labels: Record<string, string> = {
    instagram: "Instagram", telegram: "Telegram", tiktok: "TikTok",
    youtube: "YouTube", other: "Соцсеть",
  };
  const links: NonNullable<EventPageCtaConfig["socialLinks"]> = [];
  const rawLinks = !inherit && Array.isArray(contacts?.socialLinks) ? contacts.socialLinks : [];
  for (const item of rawLinks) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const network = typeof row.network === "string" ? row.network.toLowerCase() : "other";
    const href = httpLink(row.url, network);
    if (!href || links.some((link) => link.href === href)) continue;
    const path = new URL(href).pathname.replace(/^\/+|\/+$/g, "");
    links.push({
      label: labels[network] ?? "Соцсеть",
      href,
      value: network === "instagram" && path ? `@${path}` : href.replace(/^https?:\/\//i, "").replace(/\/$/, ""),
    });
  }
  if (inherit || !contacts) {
    const href = httpLink(place?.instagramUrl, "instagram");
    if (href && !links.some((link) => link.href === href)) {
      const handle = new URL(href).pathname.replace(/^\/+|\/+$/g, "");
      links.push({ label: "Instagram", href, value: handle ? `@${handle}` : href });
    }
  }
  return { website, socialLinks: links };
}
