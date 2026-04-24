"use client";

import React, { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/Container";
import {
  ArrowLeft, Share2, CalendarPlus, MapPin,
  Users, Wallet, Clock, Navigation,
} from "lucide-react";
import { formatAgeKeysShort } from "@/lib/config/ages";
import { BUDGET_LABELS, type MockRoute } from "@/mocks/routes.mock";
import { ShareSheet } from "@/components/routes/ShareSheet";
import { SaveActivityFlowAdaptive } from "@/components/activity/SaveActivityFlowAdaptive";
import type { SaveToPlanResult } from "@/components/activity/SaveToPlanModal";
import { toast } from "@/lib/toast";
import { RouteMapHero } from "@/components/routes/RouteMapHero";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";

type Props = { route: MockRoute & { isMockRoute?: boolean } };

function buildGoogleMapsUrl(stops: MockRoute["stops"]): string {
  const withCoords = stops.filter((s) => s.lat != null && s.lng != null);
  if (withCoords.length === 0) {
    const q = stops.map((s) => encodeURIComponent(s.address)).join("/");
    return `https://www.google.com/maps/dir/${q}`;
  }
  return `https://www.google.com/maps/dir/${withCoords.map((s) => `${s.lat},${s.lng}`).join("/")}`;
}

function estimateDuration(stopsCount: number): string {
  const hours = Math.round((stopsCount * 45) / 60);
  return hours <= 1 ? "~1 час" : `~${hours} часа`;
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white border border-neutral-100 shadow-sm text-sm font-medium text-neutral-700 whitespace-nowrap">
      <span className="text-neutral-400">{icon}</span>
      {label}
    </div>
  );
}

function StopCard({ stop, index, isLast }: {
  stop: MockRoute["stops"][0];
  index: number;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center shrink-0 pt-1">
        <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
          {index + 1}
        </div>
        {!isLast && <div className="w-px flex-1 bg-neutral-200 mt-2 min-h-[2.5rem]" />}
      </div>
      <div className={cn("flex-1", !isLast && "pb-6")}>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-neutral-100/80">
          {stop.photoUrl && (
            <div className="aspect-[4/3] overflow-hidden">
              <img src={stop.photoUrl} alt={stop.title ?? stop.address} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-4 space-y-3">
            <div>
              <p className="font-semibold text-neutral-900 leading-snug">
                {stop.title ?? stop.address}
              </p>
              {stop.title && stop.address && (
                <p className="flex items-center gap-1 text-sm text-neutral-400 mt-0.5">
                  <MapPin className="w-3 h-3 shrink-0" />
                  {stop.address}
                </p>
              )}
            </div>
            {stop.note && (
              <div className="bg-neutral-50 rounded-xl px-3.5 py-3">
                <p className="text-sm text-neutral-700 leading-relaxed">{stop.note}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RouteDetailClient({ route }: Props) {
  const [shareOpen, setShareOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const { isAuthenticated } = useAuthMe();
  const isDemoRouteId = /^route-\d+$/.test(route.id);

  const handlePersist = async (result: SaveToPlanResult) => {
    if (result.action === "cancel") return;
    if (result.action === "plan") {
      const res = await fetch("/api/save/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: route.id, date: result.dateISO, title: route.title, coverImageUrl: route.coverImageUrl }),
      });
      if (!res.ok) throw new Error("plan_save_failed");
      toast.success("Маршрут добавлен в план");
    } else if (result.action === "ideas") {
      if (isDemoRouteId) return;
      const res = await fetch("/api/save/idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: route.id }),
      });
      if (!res.ok) throw new Error("idea_save_failed");
      toast.success("Маршрут сохранён в идеи");
    }
  };

  const ageLabel = route.ageTags.length > 0 ? formatAgeKeysShort(route.ageTags) : null;
  const mapsUrl = buildGoogleMapsUrl(route.stops);
  const duration = estimateDuration(route.stopsCount);

  return (
    <>
      <div className="min-h-screen bg-[#F8F8F7] pb-24">

        {/* Back nav */}
        <div className="sticky top-0 z-20 bg-[#F8F8F7]/90 backdrop-blur-sm border-b border-neutral-100">
          <Container className="max-w-2xl">
            <div className="flex items-center h-12">
              <Link
                href="/routes"
                className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Маршруты
              </Link>
              {route.isEditorial && (
                <span className="ml-3 px-2 py-0.5 rounded-full bg-neutral-100 text-xs font-medium text-neutral-500">
                  от mamaGo
                </span>
              )}
            </div>
          </Container>
        </div>

        <Container className="max-w-2xl pt-6 space-y-5">

          {/* Hero map */}
          <div className="relative rounded-2xl overflow-hidden aspect-video bg-neutral-100 shadow-sm">
            <RouteMapHero
              stops={route.stops}
              fallbackImageUrl={route.coverImageUrl}
              className="absolute inset-0 w-full h-full"
            />
            {/* Overlay title card */}
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <div className="bg-white/95 backdrop-blur-md rounded-2xl px-4 py-3 shadow-lg border border-white/60">
                <h1 className="text-base font-bold text-neutral-900 leading-snug">{route.title}</h1>
                <p className="text-sm text-neutral-500 mt-0.5">
                  {route.cityName} · {route.stopsCount} точки · {duration}
                </p>
              </div>
            </div>
          </div>

          {/* Summary chips */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {ageLabel && <Chip icon={<Users className="w-3.5 h-3.5" />} label={ageLabel} />}
            <Chip icon={<Wallet className="w-3.5 h-3.5" />} label={BUDGET_LABELS[route.budgetLevel]} />
            <Chip icon={<MapPin className="w-3.5 h-3.5" />} label={`${route.stopsCount} точки`} />
            <Chip icon={<Clock className="w-3.5 h-3.5" />} label={duration} />
            {route.authorName && (
              <Chip icon={<span className="text-xs">✍</span>} label={route.authorName} />
            )}
          </div>

          {/* Action buttons row */}
          <div className="flex gap-2">
            <button
              onClick={() => setPlanOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-700 transition-colors"
            >
              <CalendarPlus className="w-4 h-4" />
              Добавить в план
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="h-11 px-4 rounded-2xl border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Share2 className="w-4 h-4" />
              Поделиться
            </button>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-11 px-4 rounded-2xl border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Navigation className="w-4 h-4" />
              <span className="hidden sm:inline">Google Maps</span>
            </a>
          </div>

          {/* Timeline stops */}
          <div>
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-5">
              Маршрут
            </p>
            {route.stops.map((stop, i) => (
              <StopCard
                key={stop.id}
                stop={stop}
                index={i}
                isLast={i === route.stops.length - 1}
              />
            ))}
          </div>

        </Container>
      </div>

      {/* Sticky mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pb-[10px]">
        <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 px-3 py-3 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-lg shadow-black/10">
            <button
              onClick={() => setPlanOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-700 transition-colors"
            >
              <CalendarPlus className="w-4 h-4" />
              Добавить в план
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="h-12 px-4 rounded-xl border border-white/60 bg-white/50 text-neutral-700 hover:bg-white/80 transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <ShareSheet open={shareOpen} onOpenChange={setShareOpen} route={route} />
      <SaveActivityFlowAdaptive
        open={planOpen}
        onOpenChange={setPlanOpen}
        isAuthenticated={isAuthenticated}
        scenario={{ kind: "quickdate", title: route.title }}
        onPersist={handlePersist}
      />
    </>
  );
}
