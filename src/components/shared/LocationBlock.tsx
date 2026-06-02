"use client";

import { Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

/** Строит HTML-страницу для srcDoc-iframe: CartoDB Positron + кастомный пulsing-пин */
function buildMapHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
  html,body,#map{height:100%;margin:0;padding:0;background:#f0ede8}
  .leaflet-control-attribution{display:none}
  .pin-wrap{position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center}
  .pin-ring{
    position:absolute;inset:0;border-radius:50%;
    background:rgba(232,106,58,0.18);
    animation:pulse-ring 2s ease-out infinite;
  }
  .pin-ring2{
    position:absolute;inset:8px;border-radius:50%;
    background:rgba(232,106,58,0.28);
    animation:pulse-ring 2s ease-out infinite 0.4s;
  }
  .pin-dot{
    width:16px;height:16px;border-radius:50%;
    background:#E86A3A;
    box-shadow:0 0 0 3px #fff,0 2px 10px rgba(232,106,58,0.55);
    position:relative;z-index:1;
  }
  @keyframes pulse-ring{
    0%{transform:scale(0.7);opacity:0.9}
    70%{transform:scale(1.4);opacity:0}
    100%{transform:scale(1.4);opacity:0}
  }
</style>
</head>
<body>
<div id="map"></div>
<script>
  const map = L.map('map',{zoomControl:true,scrollWheelZoom:false,attributionControl:false})
    .setView([${lat},${lng}],15);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{
    subdomains:'abcd',maxZoom:19
  }).addTo(map);
  const html='<div class="pin-wrap"><div class="pin-ring"></div><div class="pin-ring2"></div><div class="pin-dot"></div></div>';
  const icon=L.divIcon({html,className:'',iconSize:[48,48],iconAnchor:[24,24]});
  L.marker([${lat},${lng}],{icon}).addTo(map);
<\/script>
</body>
</html>`;
}

export interface LocationBlockProps {
  /** Название места — крупный заголовок */
  name: string;
  /** URL логотипа места */
  logoUrl?: string;
  /** Курсивная подпись оранжевым цветом (landmark / tagline) */
  tagline?: string;
  /** Адрес строкой */
  address?: string;
  /** Район */
  district?: string;
  /** Метро (без префикса «ст. м.» — добавляется автоматически) */
  metro?: string;
  /** Дополнительные чипы */
  tags?: string[];
  /** Координаты для OSM-карты */
  lat?: number;
  lng?: number;
  /** Статичная картинка карты (fallback если нет координат) */
  mapUrl?: string;
  /** Прямой URL для маршрута (если не задан — генерируется из координат / адреса) */
  routeUrl?: string;
  /** Ссылка «Подробнее о месте» */
  placeHref?: string;
  /** Телефон для кнопки «Позвонить» */
  phone?: string;
  /** Лейбл секции. По умолчанию «Где проходит» */
  kicker?: string;
  className?: string;
}

export function LocationBlock({
  name,
  logoUrl,
  tagline,
  address,
  district,
  metro,
  tags = [],
  lat,
  lng,
  mapUrl,
  routeUrl,
  placeHref,
  phone,
  kicker = "Где проходит",
  className,
}: LocationBlockProps) {
  const hasCoords = typeof lat === "number" && typeof lng === "number";

  const mapsHref =
    routeUrl ??
    (hasCoords
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      : undefined);

  const mapDoc = hasCoords ? buildMapHtml(lat!, lng!) : null;

  const chips = [
    ...(district ? [`${district} р-н`] : []),
    ...(metro ? [`ст. м. «${metro}»`] : []),
    ...tags,
  ];

  const hasMap = mapDoc || mapUrl;

  return (
    <section className={cn("border-t border-[rgba(20,18,16,0.10)] py-14 md:py-16", className)}>
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">

          {/* ── Left: text ── */}
          <div className="flex flex-col">
            {/* Kicker */}
            <div className="mb-5 flex items-center gap-3.5">
              <span
                className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]"
                style={{ fontFamily: "Menlo, monospace" }}
              >
                {kicker}
              </span>
              <span className="h-px flex-1 bg-[rgba(20,18,16,0.10)]" />
            </div>

            {/* Logo + Headline */}
            <div className="mb-5 flex items-center gap-4 leading-[1.1]">
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 99,
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "#E86A3A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontStyle: "italic",
                      fontWeight: 400,
                      fontSize: 20,
                      color: "#fff",
                    }}
                  >
                    {name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")}
                  </span>
                )}
              </div>
              <div>
              <h2 style={{ fontFamily: "var(--font-sans)", fontSize: 30, fontWeight: 400, letterSpacing: "-0.02em", color: "#141210" }}>
                {name}
              </h2>
              {tagline && (
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 32, fontWeight: 400, letterSpacing: "-0.02em", color: "#141210" }}>
                  {tagline}
                </p>
              )}
              </div>
            </div>

            {/* Address */}
            {address && (
              <p className="mb-5 text-[14px] leading-[1.65] text-[rgba(20,18,16,0.55)]">
                {address}
              </p>
            )}

            {/* Chips */}
            {chips.length > 0 && (
              <div className="mb-5 flex flex-wrap gap-2">
                {chips.map((chip, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(20,18,16,0.18)] bg-[#FAF7F1] px-3.5 py-1.5 text-[13px] font-medium text-[#141210]"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E86A3A]" />
                    {chip}
                  </span>
                ))}
              </div>
            )}

            {/* Buttons — прижаты к низу карты */}
            <div className="mt-auto flex flex-wrap gap-3">
              {mapsHref && (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#141210] px-5 py-2.5 text-[14px] font-semibold text-[#FAF7F1] transition-colors hover:bg-black"
                >
                  Маршрут <span aria-hidden>→</span>
                </a>
              )}
              {placeHref && (
                <a
                  href={placeHref}
                  className="inline-flex items-center gap-2 rounded-full border border-[rgba(20,18,16,0.18)] bg-[#FAF7F1] px-5 py-2.5 text-[14px] font-semibold text-[#141210] transition-colors hover:border-[#141210]"
                >
                  Подробнее о месте
                </a>
              )}
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="inline-flex items-center gap-2 rounded-full border border-[rgba(20,18,16,0.18)] bg-[#FAF7F1] px-5 py-2.5 text-[14px] font-semibold text-[#141210] transition-colors hover:border-[#141210]"
                >
                  Позвонить
                </a>
              )}
            </div>
          </div>

          {/* ── Right: map ── */}
          {hasMap && (
            <div
              className="relative rounded-[18px] border border-[rgba(20,18,16,0.10)] bg-[#FAF7F1] p-2"
              style={{ minHeight: 280 }}
            >
              <div
                className="relative overflow-hidden rounded-[14px]"
                style={{ aspectRatio: "4/3", minHeight: 264 }}
              >
                {mapDoc ? (
                  <iframe
                    srcDoc={mapDoc}
                    className="absolute inset-0 h-full w-full border-0"
                    title={`Карта: ${name}`}
                  />
                ) : mapUrl ? (
                  <img
                    src={mapUrl}
                    alt={`Карта: ${name}`}
                    className="h-full w-full object-cover"
                  />
                ) : null}

                {/* Bottom overlay */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-[14px] border border-[rgba(20,18,16,0.10)] bg-[rgba(250,247,241,0.96)] px-4 py-3 backdrop-blur-sm">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[#141210]">
                      &ldquo;{name}&rdquo;
                    </p>
                    {hasCoords ? (
                      <p className="font-mono text-[10px] text-[rgba(20,18,16,0.55)]">
                        {lat!.toFixed(4)}° N, {lng!.toFixed(4)}° E
                      </p>
                    ) : address ? (
                      <p className="font-mono text-[10px] text-[rgba(20,18,16,0.55)]">
                        {address}
                      </p>
                    ) : null}
                  </div>
                  {mapsHref && (
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-[#141210] transition-colors hover:text-[#E86A3A]"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      Маршрут
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
