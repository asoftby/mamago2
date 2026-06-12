"use client";

import type { OfferPageData, OfferPerk } from "@/lib/offer/offerPageTypes";

interface OfferEditorialInsightsProps {
  data: OfferPageData;
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

function buildPerks(data: OfferPageData): OfferPerk[] {
  if (Array.isArray(data.perks) && data.perks.length > 0) {
    return data.perks.slice(0, 4);
  }
  return [];
}

export function OfferEditorialInsights({ data }: OfferEditorialInsightsProps) {
  const metaFacts = buildMetaFacts(data);
  const perks = buildPerks(data);

  if (metaFacts.length === 0 && perks.length === 0) return null;

  return (
    <section aria-label="О предложении" className="space-y-0">
      {/* ── Meta facts grid ── */}
      {metaFacts.length > 0 && (
        <div
          className="grid border-y border-gray-200"
          style={{ gridTemplateColumns: `repeat(${Math.min(metaFacts.length, 5)}, 1fr)` }}
        >
          {metaFacts.map((fact, index) => (
            <article
              key={`${fact.label}-${index}`}
              className="min-w-0 border-r border-gray-200 px-8 py-6 last:border-r-0"
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <span className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-gray-400">
                  {fact.label}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-gray-300">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <p className="text-[22px] font-semibold tracking-[-0.025em] text-gray-900">
                {fact.value.charAt(0).toUpperCase() + fact.value.slice(1)}
              </p>
            </article>
          ))}
        </div>
      )}

      {/* ── Perks grid (О предложении) ── */}
      {perks.length > 0 && (
        <>
          <div className="flex items-center gap-5 pt-12">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-400">
              О предложении
            </span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <div
            className="mt-8 grid border-y border-gray-200"
            style={{ gridTemplateColumns: `repeat(${Math.min(perks.length, 2)}, 1fr)` }}
          >
            {perks.map((perk, index) => (
              <article
                key={`${perk.label}-${index}`}
                className="min-w-0 border-r border-gray-200 px-8 py-10 last:border-r-0"
              >
                <div className="mb-6 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-gray-400">
                    {perk.label}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-gray-300">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(36px,4vw,52px)",
                    lineHeight: 0.94,
                    letterSpacing: "-.035em",
                    color: "#141210",
                  }}
                >
                  {perk.stat ? perk.stat.charAt(0).toUpperCase() + perk.stat.slice(1) : ""}
                </div>
                {perk.desc && (
                  <p className="mt-4 max-w-[320px] text-[14px] leading-[1.6] text-gray-500">
                    {perk.desc}
                  </p>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
