"use client";

import type { OfferPageData, OfferPerk } from "@/lib/offer/offerPageTypes";

interface OfferEditorialInsightsProps {
  data: OfferPageData;
}

function stripHtml(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildHeadline(data: OfferPageData): { head: string; accent: string } {
  switch (data.offerType) {
    case "CAMP":
      return { head: "Лето,", accent: "без скуки." };
    case "REGULAR":
      return { head: "Каждый день,", accent: "с интересом." };
    case "SINGLE":
      return { head: "Один день,", accent: "с впечатлением." };
    default:
      return { head: "Для детей,", accent: "с пользой." };
  }
}

function buildBodyText(data: OfferPageData): string {
  const fromDescription = stripHtml(data.description);
  if (fromDescription) return fromDescription;
  return data.shortDescription?.trim() || "";
}

function buildChips(data: OfferPageData): string[] {
  const fromTags = data.place?.tags?.filter(Boolean) ?? [];
  if (fromTags.length > 0) return fromTags.slice(0, 5);
  return data.metaGrid
    .map((item) => item.value?.trim())
    .filter((value): value is string => Boolean(value))
    .slice(0, 5);
}

function buildPerks(data: OfferPageData): OfferPerk[] {
  if (Array.isArray(data.perks) && data.perks.length > 0) {
    return data.perks.slice(0, 4);
  }

  return data.metaGrid.slice(0, 4).map((item) => ({
    stat: item.value,
    label: item.label.toUpperCase(),
    desc: undefined,
  }));
}

function buildMetaFacts(data: OfferPageData) {
  return data.metaGrid
    .map((item) => ({
      label: item.label.toUpperCase(),
      value: item.value?.trim(),
    }))
    .filter((item): item is { label: string; value: string } => Boolean(item.value))
    .slice(0, 5);
}

export function OfferEditorialInsights({ data }: OfferEditorialInsightsProps) {
  const metaFacts = buildMetaFacts(data);
  const perks = buildPerks(data);
  const { head, accent } = buildHeadline(data);
  const bodyText = buildBodyText(data);
  const chips = buildChips(data);

  if (metaFacts.length === 0 && !bodyText && chips.length === 0 && perks.length === 0) return null;

  return (
    <section className="space-y-12 lg:space-y-16" aria-label="О предложении">
      {metaFacts.length > 0 && (
        <div>
          <div
            className="grid border-y border-gray-200 md:grid-cols-2 xl:grid-cols-5"
          >
            {metaFacts.map((fact, index) => (
              <article
                key={`${fact.label}-${fact.value}-${index}`}
                className="min-w-0 border-b border-gray-200 px-9 py-12 last:border-b-0 md:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0"
              >
                <div className="mb-9 flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-gray-400">
                    {fact.label}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-gray-300">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <p className="text-[24px] font-semibold tracking-[-0.03em] text-gray-900">
                  {fact.value}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}

      {bodyText && (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[420px_minmax(0,1fr)] lg:gap-14">
          <div>
            <h2 className="max-w-[360px] font-[family-name:var(--font-display)] text-[clamp(44px,6vw,70px)] leading-[0.94] tracking-[-0.035em] text-gray-900">
              {head}
              <br />
              <span className="italic text-[#EF6D3C]">{accent}</span>
            </h2>
          </div>

          <div className="space-y-8">
            <p className="max-w-[760px] text-[20px] leading-[1.48] tracking-[-0.02em] text-gray-900 lg:text-[24px]">
              {bodyText}
            </p>

            {chips.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-[#E7DDD2] bg-[#FFFCF8] px-4 py-2 text-[15px] text-gray-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {perks.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-5">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-400">
              02 — Что внутри
            </span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="grid border-y border-gray-200 md:grid-cols-2 xl:grid-cols-4">
            {perks.slice(0, 4).map((perk, index) => (
              <article
                key={`${perk.stat}-${perk.label}-${index}`}
                className="min-w-0 border-b border-gray-200 px-9 py-12 last:border-b-0 md:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0"
              >
                <div className="mb-9 flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-gray-400">
                    {perk.label}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-gray-300">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="max-w-[280px] font-[family-name:var(--font-display)] text-[clamp(48px,5vw,76px)] leading-[0.94] tracking-[-0.04em] text-gray-900">
                  {perk.stat}
                </div>
                {perk.desc && (
                  <p className="mt-5 max-w-[300px] text-[14px] leading-[1.6] text-gray-500">
                    {perk.desc}
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
