"use client";

import React, { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/Container";
import {
  ArrowLeft,
  Share2,
  CalendarPlus,
  MapPin,
  Users,
  Wallet,
  Clock,
  Navigation,
  Footprints,
  Car,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Edit,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BUDGET_LABELS, type MockRoute } from "@/mocks/routes.mock";
import { ShareSheet } from "@/components/routes/ShareSheet";
import { SaveActivityFlowAdaptive } from "@/components/activity/SaveActivityFlowAdaptive";
import type { SaveToPlanResult } from "@/components/activity/SaveToPlanModal";
import { toast } from "@/lib/toast";
import { RouteMapHero } from "@/components/routes/RouteMapHero";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

type Props = { route: MockRoute & { isMockRoute?: boolean } };

function buildGoogleMapsUrl(stops: MockRoute["stops"]): string {
  const withCoords = stops.filter((s) => s.lat != null && s.lng != null);
  if (withCoords.length === 0) {
    const q = stops.map((s) => encodeURIComponent(s.address)).join("/");
    return `https://www.google.com/maps/dir/${q}`;
  }
  return `https://www.google.com/maps/dir/${withCoords.map((s) => `${s.lat},${s.lng}`).join("/")}`;
}

function estimateDuration(
  stopsCount: number,
  travelMode: "walk" | "car",
  distance: number,
): string {
  if (travelMode === "car") {
    // Средняя скорость в городе 30 км/ч
    const hours = distance / 30;
    const minutes = Math.round(hours * 60);
    if (minutes < 60) return `~${minutes} мин`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `~${h} ч ${m} мин` : `~${h} ч`;
  }
  // Пешком
  const hours = Math.round((stopsCount * 45) / 60);
  return hours <= 1 ? "~1 час" : `~${hours} часа`;
}

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Radius of Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateRouteStats(
  stops: MockRoute["stops"],
  travelMode: "walk" | "car",
) {
  let totalDistance = 0;
  const stopsWithCoords = stops.filter((s) => s.lat != null && s.lng != null);

  for (let i = 0; i < stopsWithCoords.length - 1; i++) {
    const current = stopsWithCoords[i]!;
    const next = stopsWithCoords[i + 1]!;
    totalDistance += calculateDistance(
      current.lat!,
      current.lng!,
      next.lat!,
      next.lng!,
    );
  }

  const steps = travelMode === "walk" ? Math.round(totalDistance * 1400) : 0;
  const calories = travelMode === "walk" ? Math.round(totalDistance * 60) : 0;

  return {
    distance: totalDistance,
    steps,
    calories,
  };
}
// ─── Photo Gallery Modal ──────────────────────────────────────────────────────

function PhotoGalleryModal({
  photos,
  initialIndex = 0,
  onClose,
}: {
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {photos.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      <div className="w-full h-full flex items-center justify-center p-4">
        <img
          src={photos[currentIndex]}
          alt={`Фото ${currentIndex + 1} из ${photos.length}`}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {photos.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {photos.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                idx === currentIndex ? "bg-white w-6" : "bg-white/50",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stop Card ────────────────────────────────────────────────────────────────

function StopCard({
  stop,
  index,
  isLast,
  onPhotoClick,
}: {
  stop: MockRoute["stops"][number];
  index: number;
  isLast: boolean;
  onPhotoClick?: (photos: string[], photoIndex: number) => void;
}) {
  // Use photos array if available, otherwise convert single photoUrl for backward compatibility
  const photos =
    stop.photos && stop.photos.length > 0
      ? stop.photos
      : stop.photoUrl
        ? [stop.photoUrl]
        : [];
  const showGallery = photos.length > 0;
  const displayPhotos = photos.slice(0, 3);
  const remainingCount = photos.length - 3;
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center shrink-0 pt-1">
        <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
          {index + 1}
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-neutral-200 mt-2 min-h-[2.5rem]" />
        )}
      </div>
      <div className={cn("flex-1", !isLast && "pb-6")}>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-neutral-100/80">
          {showGallery && (
            <div className="grid grid-cols-3 gap-1">
              {displayPhotos.map((photo, photoIdx) => (
                <div
                  key={photoIdx}
                  className={cn(
                    "aspect-square overflow-hidden relative cursor-pointer group",
                    photoIdx === 0 &&
                      displayPhotos.length === 1 &&
                      "col-span-3 aspect-[4/3]",
                  )}
                  onClick={() => onPhotoClick?.(photos, photoIdx)}
                >
                  <img
                    src={photo}
                    alt={`${stop.title ?? stop.address} - фото ${photoIdx + 1}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  {photoIdx === 2 && remainingCount > 0 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-white text-lg font-bold">
                        +{remainingCount}
                      </span>
                    </div>
                  )}
                </div>
              ))}
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
                <p className="text-sm text-neutral-700 leading-relaxed">
                  {stop.note}
                </p>
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
  const [travelMode, setTravelMode] = useState<"walk" | "car">("walk");
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
  const { isAuthenticated, user } = useAuthMe();
  const isDemoRouteId = /^route-\d+$/.test(route.id);

  // Check if user can edit this route (author or admin)
  const canEdit =
    !isDemoRouteId &&
    user &&
    (route.authorName === user.email ||
      user.role === "ADMIN" ||
      user.role === "MODERATOR");

  const handlePhotoClick = (photos: string[], initialIndex: number) => {
    setGalleryPhotos(photos);
    setGalleryInitialIndex(initialIndex);
    setGalleryOpen(true);
  };

  const handlePersist = async (result: SaveToPlanResult) => {
    if (result.action === "cancel") return;
    if (result.action === "plan") {
      const res = await fetch("/api/save/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: route.id,
          date: result.dateISO,
          title: route.title,
          coverImageUrl: route.coverImageUrl,
        }),
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

  const mapsUrl = buildGoogleMapsUrl(route.stops);
  const routeStats = calculateRouteStats(route.stops, travelMode);
  const duration = estimateDuration(
    route.stopsCount,
    travelMode,
    routeStats.distance,
  );

  const minAge =
    route.ageTags.length > 0
      ? Math.min(
          ...route.ageTags.map((tag) => parseInt(tag.split("-")[0] ?? "0", 10)),
        )
      : null;
  const ageLabel = minAge !== null ? `${minAge}+` : null;

  return (
    <>
      <div className="min-h-screen bg-[#F8F8F7] pb-24">
        {/* Back nav */}
        <div className="sticky top-0 z-20 bg-[#F8F8F7]/90 backdrop-blur-sm border-b border-neutral-100">
          <Container className="max-w-2xl">
            <div className="flex items-center justify-between h-12">
              <Link
                href="/routes"
                className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Маршруты
              </Link>
              {route.isEditorial && (
                <span className="flex items-center px-2.5 py-1 rounded-full bg-[#fdf4ee] text-xs font-medium text-neutral-500">
                  от mamaGo
                </span>
              )}
            </div>
          </Container>
        </div>

        <Container className="max-w-2xl pt-6 space-y-5">
          {/* Hero map */}
          <div
            className={cn(
              "relative overflow-hidden bg-neutral-100 shadow-sm",
              mapFullscreen
                ? "fixed inset-0 z-50 rounded-none"
                : "rounded-2xl aspect-video",
            )}
          >
            <RouteMapHero
              stops={route.stops}
              fallbackImageUrl={route.coverImageUrl}
              className="absolute inset-0 w-full h-full"
              travelMode={travelMode}
            />

            {/* Travel mode toggle — top left */}
            <div className="absolute top-3 left-3 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-xl p-1 shadow-md border border-white/60">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTravelMode("walk");
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  travelMode === "walk"
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                <Footprints className="w-3.5 h-3.5" />
                Пешком
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTravelMode("car");
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  travelMode === "car"
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                <Car className="w-3.5 h-3.5" />
                На авто
              </button>
            </div>

            {/* Fullscreen toggle — top right */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMapFullscreen((v) => !v);
              }}
              className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-xl bg-white/90 backdrop-blur-sm shadow-md border border-white/60 text-neutral-600 hover:text-neutral-900 transition-colors"
              aria-label={mapFullscreen ? "Свернуть карту" : "Развернуть карту"}
            >
              {mapFullscreen ? (
                <X className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>

            {/* Overlay title card */}
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <div className="bg-white/95 backdrop-blur-md rounded-2xl px-4 py-3 shadow-lg border border-white/60 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h1 className="text-base font-bold text-neutral-900 leading-snug">
                    Маршрут «{route.title}»
                  </h1>
                  {routeStats.distance > 0 && (
                    <div className="flex items-center gap-3 mt-1.5">
                      {travelMode === "walk" ? (
                        <>
                          <span className="text-xs text-neutral-600 font-medium">
                            🔥 {routeStats.calories} ккал
                          </span>
                          <span className="text-xs text-neutral-400">·</span>
                          <span className="text-xs text-neutral-600 font-medium">
                            👣 {routeStats.steps.toLocaleString("ru-RU")} шагов
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-neutral-600 font-medium">
                          🚗 {routeStats.distance.toFixed(1)} км
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 h-10 px-3 rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 transition-colors flex items-center gap-1.5 text-sm font-medium"
                >
                  <Navigation className="w-4 h-4" />
                  Google Maps
                </a>
              </div>
            </div>
          </div>

          {/* Summary stats */}
          <div className="flex items-center bg-white border border-neutral-100 rounded-2xl shadow-sm px-4 py-3">
            {ageLabel && (
              <>
                <div className="flex items-center gap-2 flex-1 justify-center">
                  <Users className="w-4 h-4 text-violet-500 shrink-0" />
                  <span className="text-sm font-medium text-neutral-700">
                    {ageLabel}
                  </span>
                </div>
                <div className="w-px h-5 bg-neutral-200 shrink-0" />
              </>
            )}
            <div className="flex items-center gap-2 flex-1 justify-center">
              <MapPin className="w-4 h-4 text-[#EF8759] shrink-0" />
              <span className="text-sm font-medium text-neutral-700">
                {route.stopsCount} точки
              </span>
            </div>
            <div className="w-px h-5 bg-neutral-200 shrink-0" />
            <div className="flex items-center gap-2 flex-1 justify-center">
              <Clock className="w-4 h-4 text-sky-500 shrink-0" />
              <span className="text-sm font-medium text-neutral-700">
                {duration}
              </span>
            </div>
            <div className="w-px h-5 bg-neutral-200 shrink-0" />
            <div className="flex items-center gap-2 flex-1 justify-center">
              <Wallet className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-sm font-medium text-neutral-700">
                {BUDGET_LABELS[route.budgetLevel]}
              </span>
            </div>
          </div>

          {/* Author block */}
          <div className="flex items-center gap-3">
            <div className="shrink-0 h-10 w-10 rounded-full overflow-hidden bg-neutral-200 flex items-center justify-center">
              {route.authorAvatar ? (
                <img
                  src={route.authorAvatar}
                  alt={route.authorName ?? "mamaGo"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-neutral-500">
                  {route.isEditorial ? "M" : (route.authorName?.[0] ?? "?")}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900 leading-tight">
                {route.isEditorial ? "mamaGo" : (route.authorName ?? "Автор")}
              </p>
              {(route.updatedAt || route.createdAt) && (
                <p className="text-xs text-neutral-400 mt-0.5">
                  {route.updatedAt ? "Обновлено" : "Создано"}{" "}
                  {format(
                    parseISO(route.updatedAt || route.createdAt!),
                    "d MMMM yyyy",
                    { locale: ru },
                  )}
                </p>
              )}
            </div>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors text-sm font-medium">
                    <Edit className="w-3.5 h-3.5" />
                    Редактировать
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link href={`/routes/${route.slug}/edit?step=1`} className="cursor-pointer">
                      Основная информация
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/routes/${route.slug}/edit?step=2`} className="cursor-pointer">
                      Точки маршрута
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/routes/${route.slug}/edit?step=3`} className="cursor-pointer">
                      Просмотр и публикация
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
                onPhotoClick={handlePhotoClick}
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
              className="h-12 px-4 rounded-xl border border-white/60 bg-white/50 text-neutral-700 hover:bg-white/80 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Share2 className="w-4 h-4" />
              Поделиться
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
      {galleryOpen && (
        <PhotoGalleryModal
          photos={galleryPhotos}
          initialIndex={galleryInitialIndex}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </>
  );
}
