"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useOptionalCity } from "@/contexts/CityContext";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";
import { planEntryDisplay } from "../../lib/planEntryDisplay";
import { planItemLinkKind } from "../../lib/planItemLink";
import type { PlanItemWithActivity } from "../../types/event";
import { CatalogPreviewScreen, PREVIEW_PRIMARY, PreviewFooterButtons, type PreviewRow } from "../CatalogPreviewScreen";

function formatDay(dateISO: string): string {
  const label = new Date(`${dateISO}T12:00:00`).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Public page of a place / offer entry; a route has no page of its own. Only safe slugs become a path. */
export function planEntryHref(item: PlanItemWithActivity, fallbackCity: string): { href: string; label: string } | null {
  const safe = (value: string | null | undefined) => (value && /^[A-Za-z0-9_-]+$/.test(value) ? value : null);
  const kind = planItemLinkKind(item);
  if (kind === "place") {
    const slug = safe(item.planPlaceSlug);
    return slug ? { href: `/${fallbackCity}/places/${slug}`, label: "Открыть страницу места" } : null;
  }
  if (kind === "offer") {
    const slug = safe(item.offer?.slug);
    const city = safe(item.offer?.place?.city?.slug) ?? fallbackCity;
    return slug ? { href: `/${city}/offers/${slug}`, label: "Открыть предложение" } : null;
  }
  return null;
}

/**
 * The short preview of a place, an offer or a route in the plan: built from the entry's own fields (title, cover,
 * time, address kept at save), so opening it asks the server for nothing. Layout: CatalogPreviewScreen.
 */
export function PlanEntryScreen({
  item,
  onBack,
  onRemove,
  onMove,
  onNavigate,
}: {
  item: PlanItemWithActivity;
  onBack: () => void;
  onRemove: () => void;
  onMove?: () => void;
  onNavigate?: () => void;
}) {
  const cityCtx = useOptionalCity();
  const city = cityCtx?.citySlug ?? DEFAULT_CITY_SLUG;
  const kind = planItemLinkKind(item);
  const { title, poster, time } = planEntryDisplay(item);
  const link = planEntryHref(item, city);
  const offerPrice = item.offer?.priceText?.trim() || (item.offer?.priceFrom != null ? `от ${item.offer.priceFrom} BYN` : null);
  const rows: PreviewRow[] = [{ icon: "date", primary: `${formatDay(item.date)} · ${time ?? "в любое время"}`, secondary: item.timeType === "SUGGESTED" ? "время подобрал mamaGo, уточните" : undefined }];
  if (item.locationText?.trim()) rows.push({ icon: "place", primary: item.locationText.trim() });
  if (offerPrice) rows.push({ icon: "price", primary: offerPrice });

  return (
    <CatalogPreviewScreen
      back="План"
      onBack={onBack}
      badge={kind === "offer" ? "Предложение" : kind === "route" ? "Маршрут" : "Место"}
      tone={kind === "offer" ? "offer" : "place"}
      fromScenario={Boolean(item.scenarioId)}
      coverUrl={poster ?? item.offer?.coverImage ?? null}
      title={title}
      rows={rows}
      linkSlot={
        link ? (
          <Link href={link.href} onClick={onNavigate} className="mx-auto mt-3.5 flex min-h-11 w-fit items-center gap-2 rounded-xl px-2.5 text-[15.5px] font-bold text-[var(--mp-ac-dark)] no-underline transition-colors hover:text-[var(--mp-ac)]">
            <ExternalLink className="h-[17px] w-[17px]" aria-hidden />
            {link.label}
          </Link>
        ) : null
      }
      footer={
        <>
          <PreviewFooterButtons onRemove={onRemove} onMove={onMove} />
          {link ? (
            <Link href={link.href} onClick={onNavigate} className={PREVIEW_PRIMARY}>
              {link.label}
            </Link>
          ) : null}
        </>
      }
    />
  );
}
