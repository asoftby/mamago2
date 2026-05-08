"use client";

import { MapPin, Navigation, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PlaceMapSectionProps {
  address: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  district?: string;
}

const peachShellClass =
  "relative overflow-hidden rounded-[34px] border border-[#ffd8c4] shadow-[0_28px_70px_rgba(245,140,90,0.18),inset_0_1px_0_rgba(255,255,255,0.9)] bg-[radial-gradient(circle_at_top_left,_rgba(255,216,196,0.42),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(255,181,138,0.24),_transparent_34%),linear-gradient(135deg,_#fffaf5_0%,_#fff6ef_45%,_#fff9f6_100%)]";

export function PlaceMapSection({
  address,
  latitude,
  longitude,
  city,
  district,
}: PlaceMapSectionProps) {
  const openInMaps = () => {
    if (latitude && longitude) {
      window.open(
        `https://maps.google.com/?q=${latitude},${longitude}`,
        "_blank"
      );
    } else {
      window.open(
        `https://maps.google.com/?q=${encodeURIComponent(address)}`,
        "_blank"
      );
    }
  };

  const getDirections = () => {
    if (latitude && longitude) {
      window.open(
        `https://maps.google.com/maps?daddr=${latitude},${longitude}`,
        "_blank"
      );
    } else {
      window.open(
        `https://maps.google.com/maps?daddr=${encodeURIComponent(address)}`,
        "_blank"
      );
    }
  };

  return (
    <motion.section
      id="map"
      className="scroll-mt-32 space-y-6"
      initial={{ opacity: 0, y: 34 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-120px" }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="space-y-3">
        <h2 className="text-4xl font-black tracking-[-0.02em] text-[#0D1025] sm:text-5xl">
          Найти легко
        </h2>
      </div>

      <div className={cn(peachShellClass, "p-3")}>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-40 bg-[radial-gradient(circle,_rgba(255,201,167,0.22),_transparent_68%)] blur-2xl" />
        <div className="pointer-events-none absolute -right-12 top-1/2 h-36 w-36 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,_rgba(255,170,120,0.28),_transparent_70%)] blur-3xl" />

        <div className="relative grid min-h-[520px] grid-cols-1 overflow-hidden rounded-[28px] border border-[#ffd8c4]/70 bg-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] lg:grid-cols-[360px_1fr]">
          <div
            className={cn(
              "z-10 flex flex-col justify-between gap-8 border-[#ffd8c4]/80 bg-white/80 p-7 backdrop-blur-xl",
              "border-b lg:border-b-0 lg:border-r",
            )}
          >
            <div className="space-y-5">
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl border border-[#ffd8c4]",
                  "bg-[linear-gradient(180deg,_rgba(255,255,255,0.92)_0%,_rgba(255,241,232,0.96)_100%)] text-[#EF8759]",
                  "shadow-[inset_0_2px_3px_rgba(255,255,255,0.9)]",
                )}
              >
                <MapPin className="h-7 w-7" />
              </div>
              <div>
                <div className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-[#EF8759]">
                  Адрес
                </div>
                <div className="text-2xl font-black leading-tight text-neutral-900">
                  {address}
                </div>
                {city && (
                  <div className="mt-3 text-sm text-neutral-600">{city}</div>
                )}
                {district && (
                  <div className="text-sm text-neutral-600">{district}</div>
                )}
              </div>
            </div>

            <div className="grid gap-3">
              <Button
                variant="ghost"
                className="h-12 justify-start rounded-2xl border border-[#ffd8c4] bg-white/70 font-semibold text-neutral-900 shadow-none hover:bg-white"
                onClick={openInMaps}
              >
                <MapPin className="mr-2 h-4 w-4 text-[#EF8759]" />
                Открыть карту
              </Button>
              <Button
                className="h-12 justify-start rounded-2xl border border-[#ffb38a] bg-[linear-gradient(180deg,_#ffb185_0%,_#ff8f61_100%)] font-black text-white shadow-[0_12px_28px_rgba(255,146,93,0.28)] hover:opacity-[0.98]"
                onClick={getDirections}
              >
                <Navigation className="mr-2 h-4 w-4" />
                Построить маршрут
              </Button>
            </div>
          </div>

          <div className="relative min-h-[420px] bg-[#faf8f7]">
            {latitude && longitude ? (
              <iframe
                width="100%"
                height="100%"
                className="absolute inset-0 rounded-b-[28px] border-0 lg:rounded-none lg:rounded-r-[28px]"
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}&q=${latitude},${longitude}&zoom=15`}
              />
            ) : (
              <div className="absolute inset-0 rounded-b-[28px] bg-[#fffaf7] lg:rounded-none lg:rounded-r-[28px]">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,216,196,0.16)_23%,transparent_23%),linear-gradient(225deg,rgba(239,135,89,0.08)_23%,transparent_23%),linear-gradient(45deg,rgba(108,99,255,0.06)_23%,transparent_23%)] [background-size:52px_52px]" />
                <div className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#EF8759] shadow-[0_0_0_14px_rgba(239,135,89,0.14),0_10px_40px_rgba(239,135,89,0.35)]" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-[#ffd8c4] bg-white/72 p-6 shadow-[0_20px_70px_rgba(245,140,90,0.08)] backdrop-blur-xl">
        <div className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-[#EF8759]">
          <Route className="h-4 w-4" />
          Как добраться
        </div>
        <p className="text-sm leading-7 text-[#555A70]">
          Используйте кнопку маршрута, чтобы открыть навигацию. Перед визитом лучше уточнить время работы и удобный вход.
        </p>
      </div>
    </motion.section>
  );
}
