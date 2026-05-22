"use client";

import { Navigation } from "lucide-react";
import type { OfferPageData } from "@/lib/offer/offerPageTypes";

interface OfferPlaceProps {
  place: NonNullable<OfferPageData["place"]>;
}

/**
 * Place Block — "Где проходит".
 *
 * Левая колонка: editorial заголовок (место + курсивный тэглайн),
 * адрес, фишки (район, метро, теги), кнопки.
 * Правая колонка: встроенная OSM-карта или плейсхолдер.
 */
export function OfferPlace({ place }: OfferPlaceProps) {
  const hasCoords =
    typeof place.lat === "number" && typeof place.lng === "number";

  const mapSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${place.lng! - 0.012},${place.lat! - 0.009},${place.lng! + 0.012},${place.lat! + 0.009}&layer=mapnik&marker=${place.lat},${place.lng}`
    : null;

  const mapsHref = hasCoords
    ? `https://www.google.com/maps?q=${place.lat},${place.lng}`
    : place.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}`
    : "#";

  const chips: string[] = [
    ...(place.district ? [place.district] : []),
    ...(place.metro ? [`ст. м. «${place.metro}»`] : []),
    ...(place.tags ?? []),
  ];

  return (
    <section className="space-y-7">
      {/* Editorial kicker */}
      <div className="flex items-center gap-3.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-gray-400">
          06 — Где проходит
        </span>
        <span className="h-px flex-1 bg-gray-100 max-w-[180px]" />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* ── Left ── */}
        <div className="flex flex-col gap-5">
          {/* Headline */}
          <div className="leading-[0.95]">
            <h2 className="font-sans text-[40px] lg:text-[52px] font-semibold tracking-[-0.02em] text-gray-900">
              {place.name},
            </h2>
            {place.tagline && (
              <p className="font-sans text-[40px] lg:text-[52px] font-semibold italic tracking-[-0.02em] text-[#C2522A]">
                {place.tagline}.
              </p>
            )}
          </div>

          {/* Address */}
          {place.address && (
            <div className="space-y-0.5 text-[14px] leading-[1.65] text-gray-500">
              {place.address.split(/\n|·/).map((line, i) => (
                <p key={i}>{line.trim()}</p>
              ))}
            </div>
          )}

          {/* Chips */}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map((chip, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-gray-700"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#EF8759]" />
                  {chip}
                </span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-gray-700"
            >
              Маршрут <span aria-hidden>→</span>
            </a>
            {place.slug && (
              <a
                href={`/places/${place.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-[14px] font-semibold text-gray-700 transition-colors hover:border-gray-400"
              >
                Подробнее о месте
              </a>
            )}
          </div>
        </div>

        {/* ── Right: Map ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gray-100 aspect-[4/3] lg:aspect-auto lg:min-h-[340px]">
          {mapSrc ? (
            <iframe
              src={mapSrc}
              className="absolute inset-0 h-full w-full border-0"
              loading="lazy"
              title={`Карта: ${place.name}`}
            />
          ) : (
            /* Placeholder when no coordinates */
            <div className="flex h-full min-h-[280px] items-center justify-center">
              <p className="text-[13px] text-gray-400 text-center px-6">
                {place.address}
              </p>
            </div>
          )}

          {/* Bottom overlay bar */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-white/95 px-4 py-3 backdrop-blur-sm">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-gray-900">
                &ldquo;{place.name}&rdquo;
              </p>
              {hasCoords && (
                <p className="font-mono text-[10px] text-gray-400">
                  {place.lat!.toFixed(4)}° N, {place.lng!.toFixed(4)}° E
                </p>
              )}
            </div>
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-4 flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-gray-700 transition-colors hover:text-gray-900"
            >
              <Navigation className="h-3.5 w-3.5" />
              Маршрут
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
