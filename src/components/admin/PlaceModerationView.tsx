"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Phone, Globe, Instagram, ArrowLeft, ExternalLink, Clock, Building2 } from "lucide-react";
import { RichContentRenderer } from "@/components/content/RichContentRenderer";
import { formatDistance } from "@/lib/formatDistance";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "@/lib/toast";
import { formatAgeKeys } from "@/lib/config/ages";
import { getPlacePublicUrl } from "@/lib/placePublicUrl";
import { PlaceDangerZone } from "@/components/admin/moderation/PlaceDangerZone";
import { Textarea } from "@/components/ui/textarea";
import { getFormatLabel } from "@/lib/placeChips";
import { GoogleReviewsStatusBadge } from "@/components/admin/moderation/GoogleReviewsStatusBadge";
import { FaqReadonlySection } from "@/components/admin/moderation/FaqReadonlySection";
import { DAY_SHORT_LABELS, ALL_DAYS, MODE_LABELS } from "@/components/openingHours/openingHours.types";
import { getPlaceDetailBackLink } from "@/lib/admin/placeDetailNavigation";
import type { OpeningHoursWithRelations } from "@/server/services/openingHours/openingHours.types";

const STATUS_CONFIG = {
  DRAFT: { label: "Черновик", variant: "secondary" as const, className: "" },
  PENDING: { label: "На модерации", variant: "outline" as const, className: "bg-gray-100 text-gray-700 border-gray-200" },
  PUBLISHED: { label: "Опубликовано", variant: "default" as const, className: "" },
  NEEDS_REVISION: { label: "Требует правок", variant: "destructive" as const, className: "" },
  REJECTED: { label: "Отклонено", variant: "destructive" as const, className: "" },
};

interface PlaceModerationViewProps {
  place: {
    id: string;
    title: string;
    status: string;
    displayAddress?: string | null;
    formattedAddr?: string | null;
    customAddress?: string | null;
    locationName?: string | null;
    directionsNote?: string | null;
    districtManual?: { name: string } | null;
    districtAuto?: { name: string } | null;
    metroManual?: { name: string } | null;
    metroAuto?: { name: string } | null;
    metroManualDistanceM?: number | null;
    metroAutoDistanceM?: number | null;
    city?: { id: string; name: string; hasMetro?: boolean | null; metroMaxDistanceM?: number | null } | null;
    images: Array<{ id: string; url: string; kind: string; sortOrder: number; width?: number | null; height?: number | null; blurhash?: string | null }>;
    shortDesc?: string | null;
    description?: string | null;
    faqItems?: unknown;
    lat?: number | null;
    lng?: number | null;
    placeKind?: string | null;
    floor?: string | null;
    unit?: string | null;
    unitLabel?: string | null;
    phone?: string | null;
    website?: string | null;
    instagramHandle?: string | null;
    instagramUrl?: string | null;
    ageTags: string[];
    visitFormats: string[];
    activityTypes: string[];
    googlePlaceId?: string | null;
    googleRating?: number | null;
    googleUserRatingsTotal?: number | null;
    googleReviewsJson?: unknown;
    slug?: string | null;
    shortAddress?: string | null;
    ownerBusiness?: { id: string; name: string } | null;
    createdBy?: { business: { name: string } | null; email?: string | null } | null;
    openingHours?: OpeningHoursWithRelations | null;
    createdAt: Date;
  };
  canDeletePlace?: boolean;
}

function formatOpeningHours(openingHours: OpeningHoursWithRelations | null | undefined) {
  if (!openingHours) {
    return null;
  }

  if (openingHours.mode === "ALWAYS_OPEN") {
    return <p className="text-sm text-gray-700">Круглосуточно</p>;
  }

  if (openingHours.mode === "BY_APPOINTMENT") {
    return <p className="text-sm text-gray-700">По записи</p>;
  }

  if (openingHours.mode === "TEMPORARILY_CLOSED") {
    return (
      <div className="space-y-1">
        <p className="text-sm text-gray-700">
          {MODE_LABELS[openingHours.mode as keyof typeof MODE_LABELS]}
        </p>
        {openingHours.note ? <p className="text-sm text-gray-500">{openingHours.note}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {ALL_DAYS.map((dayOfWeek) => {
        const rule = openingHours.rules.find((item) => item.dayOfWeek === dayOfWeek);
        const label = DAY_SHORT_LABELS[dayOfWeek];

        let value = "Выходной";
        if (rule?.isOpen) {
          if (rule.allDay) {
            value = "Круглосуточно";
          } else if (rule.intervals.length > 0) {
            value = rule.intervals.map((interval) => `${interval.startTime}-${interval.endTime}`).join(", ");
          }
        }

        return (
          <div key={dayOfWeek} className="flex items-center justify-between gap-4 text-sm">
            <span className="font-medium text-gray-700">{label}</span>
            <span className="text-right text-gray-600">{value}</span>
          </div>
        );
      })}
      {openingHours.note ? <p className="pt-1 text-sm text-gray-500">{openingHours.note}</p> : null}
    </div>
  );
}

export function PlaceModerationView({
  place,
  canDeletePlace = false,
}: PlaceModerationViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const backLink = getPlaceDetailBackLink(searchParams.get("returnTo"));

  const statusConfig = STATUS_CONFIG[place.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.DRAFT;

  // Get display values
  const displayAddress =
    place.displayAddress || place.formattedAddr || place.customAddress || "Адрес не указан";
  const districtName = place.districtManual?.name ?? place.districtAuto?.name;
  const metroName = place.metroManual?.name ?? place.metroAuto?.name;
  const metroDistance = place.metroManualDistanceM ?? place.metroAutoDistanceM;
  const cityHasMetro = place.city?.hasMetro ?? false;
  const metroMaxDistance = place.city?.metroMaxDistanceM ?? 2500;
  const businessName = place.ownerBusiness?.name ?? place.createdBy?.business?.name ?? null;
  const locationMeta: string[] = [
    place.locationName ? `Ориентир: ${place.locationName}` : null,
    place.directionsNote ? `Как найти: ${place.directionsNote}` : null,
    place.floor ? `Этаж: ${place.floor}` : null,
    place.unit ? `${place.unitLabel || "Помещение"}: ${place.unit}` : null,
  ].filter((value): value is string => Boolean(value));

  const shouldShowMetro =
    metroName &&
    metroDistance !== null &&
    metroDistance !== undefined &&
    cityHasMetro &&
    metroDistance <= metroMaxDistance;

  // Images
  const logoImage = place.images.find((img) => img.kind === "LOGO");
  const galleryImages = place.images.filter((img) => img.kind === "GALLERY");

  const handleModerate = async (action: "APPROVE" | "NEEDS_REVISION" | "REJECT") => {
    if ((action === "NEEDS_REVISION" || action === "REJECT") && !comment.trim()) {
      toast.error("Пожалуйста, укажите причину");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/moderation/places/${place.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          comment: comment.trim() || null,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        let error;
        try {
          error = JSON.parse(text);
        } catch {
          error = { message: text || "Failed to moderate" };
        }
        console.error("Moderation failed:", {
          status: response.status,
          statusText: response.statusText,
          error,
        });
        throw new Error(error.message || error.error || "Failed to moderate");
      }

      toast.success("Модерация завершена");
      router.push("/admin/moderation/queue");
      router.refresh();
    } catch (error) {
      console.error("Moderation error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка модерации");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link
            href={backLink.href}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLink.label}
          </Link>
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/editor/place/${place.id}/edit?returnTo=${encodeURIComponent(`/admin/content/places/${place.id}`)}`}
            >
              Открыть в редакторе
            </Link>
          </Button>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Модерация места</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Content Preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Logo */}
          {logoImage && (
            <div className="relative w-full h-64 rounded-lg overflow-hidden bg-gray-100">
              <Image
                src={logoImage.url}
                alt={place.title}
                fill
                className="object-cover"
              />
            </div>
          )}

          {/* Title and Basic Info */}
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{place.title}</h2>
            {place.shortDesc ? <p className="text-lg text-gray-600">{place.shortDesc}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {place.placeKind ? (
                <Badge variant="outline" className="bg-white text-gray-700">
                  {place.placeKind}
                </Badge>
              ) : null}
              {place.city ? (
                <Badge variant="outline" className="bg-white text-gray-700">
                  {place.city.name}
                </Badge>
              ) : null}
              {businessName ? (
                <Badge variant="outline" className="bg-white text-gray-700">
                  <Building2 className="mr-1 h-3 w-3" />
                  {businessName}
                </Badge>
              ) : null}
            </div>
          </div>

          {/* Description */}
          {place.description && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Описание</h3>
              <RichContentRenderer
                html={place.description}
                className="prose-gray max-w-none text-base leading-relaxed text-gray-700 prose-p:text-base prose-p:leading-relaxed prose-p:text-gray-700 prose-p:my-5 [&>p:last-child]:mb-0 prose-headings:text-gray-900 prose-strong:text-gray-900 [&>p:first-child]:mt-0"
              />
            </div>
          )}

          <FaqReadonlySection items={place.faqItems} />

          {/* Location */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Местоположение</h3>
            <div className="space-y-2">
              <p className="text-gray-700">{displayAddress}</p>
              {locationMeta.length > 0 && (
                <div className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                  {locationMeta.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              )}
              <GoogleReviewsStatusBadge
                googlePlaceId={place.googlePlaceId}
                googleRating={place.googleRating}
                googleUserRatingsTotal={place.googleUserRatingsTotal}
                googleReviewsJson={place.googleReviewsJson}
              />

              {(districtName || shouldShowMetro) && (
                <div className="flex items-center gap-3 flex-wrap">
                  {districtName && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded">
                      <MapPin className="w-4 h-4" />
                      {districtName}
                    </span>
                  )}

                  {shouldShowMetro && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-blue-700 bg-blue-50 rounded">
                      <Navigation className="w-4 h-4" />
                      {metroName} • {formatDistance(metroDistance)}
                    </span>
                  )}
                </div>
              )}

              {place.lat && place.lng && (
                <p className="text-sm text-gray-500">
                  Координаты: {place.lat.toFixed(6)}, {place.lng.toFixed(6)}
                </p>
              )}
            </div>
          </div>

          {/* Contacts */}
          {(place.phone || place.website || place.instagramHandle || place.instagramUrl) && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Контакты</h3>
              <div className="space-y-2">
                {place.phone && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <Phone className="w-4 h-4" />
                    <a href={`tel:${place.phone}`} className="hover:text-blue-600">
                      {place.phone}
                    </a>
                  </div>
                )}

                {place.website && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <Globe className="w-4 h-4" />
                    <a
                      href={place.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600"
                    >
                      {place.website}
                    </a>
                  </div>
                )}

                {(place.instagramHandle || place.instagramUrl) && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <Instagram className="w-4 h-4" />
                    <a
                      href={place.instagramUrl || `https://instagram.com/${place.instagramHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600"
                    >
                      {place.instagramHandle ? `@${place.instagramHandle}` : place.instagramUrl}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {place.openingHours && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-700" />
                <h3 className="text-lg font-semibold text-gray-900">Режим работы</h3>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                {formatOpeningHours(place.openingHours)}
              </div>
            </div>
          )}

          {/* Gallery */}
          {galleryImages.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Галерея</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {galleryImages.map((image) => (
                  <div
                    key={image.id}
                    className="relative aspect-square rounded-lg overflow-hidden bg-gray-100"
                  >
                    <Image
                      src={image.url}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {(place.ageTags.length > 0 || place.visitFormats.length > 0 || place.activityTypes.length > 0) && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Теги</h3>
              <div className="space-y-2">
                {place.ageTags.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Возраст: </span>
                    <span className="text-sm text-gray-700">{formatAgeKeys(place.ageTags)}</span>
                  </div>
                )}
                {place.visitFormats.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Форматы: </span>
                    <span className="text-sm text-gray-700">
                      {place.visitFormats.map(getFormatLabel).join(", ")}
                    </span>
                  </div>
                )}
                {place.activityTypes.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Типы активностей: </span>
                    <span className="text-sm text-gray-700">{place.activityTypes.join(", ")}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Moderation Panel (Sticky) */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Модерация</h3>

            {/* Place Info */}
            <div className="space-y-3 mb-6 pb-6 border-b">
              <div>
                <span className="text-sm font-medium text-gray-600">Статус:</span>
                <div className="mt-1">
                  <Badge variant={statusConfig.variant} className={statusConfig.className}>{statusConfig.label}</Badge>
                </div>
              </div>

              <div>
                <span className="text-sm font-medium text-gray-600">Тип:</span>
                <p className="text-sm text-gray-900 mt-1">Место</p>
              </div>

              {place.city && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Город:</span>
                  <p className="text-sm text-gray-900 mt-1">{place.city.name}</p>
                </div>
              )}

              {businessName && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Бизнес:</span>
                  <p className="text-sm text-gray-900 mt-1">{businessName}</p>
                </div>
              )}

              <div>
                <span className="text-sm font-medium text-gray-600">Создано:</span>
                <p className="text-sm text-gray-900 mt-1">
                  {formatDistanceToNow(place.createdAt, { addSuffix: true, locale: ru })}
                </p>
              </div>
            </div>

            {/* Moderator Comment */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Комментарий модератора
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Укажите причину отклонения или необходимые правки..."
                className="min-h-[100px] text-sm"
                disabled={isSubmitting}
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                onClick={() => handleModerate("APPROVE")}
                disabled={isSubmitting || place.status === "PUBLISHED"}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? "Обработка..." : "Одобрить"}
              </Button>

              <Button
                onClick={() => handleModerate("NEEDS_REVISION")}
                disabled={isSubmitting || !comment.trim()}
                variant="outline"
                className="w-full"
              >
                На доработку
              </Button>

              <Button
                onClick={() => handleModerate("REJECT")}
                disabled={isSubmitting}
                variant="destructive"
                className="w-full"
              >
                Отклонить
              </Button>
            </div>

            {/* View Place Actions */}
            <div className="mt-6 pt-4 border-t space-y-2">
              {/* Primary CTA: Public place page */}
              {getPlacePublicUrl({ status: place.status, slug: place.slug ?? null }) ? (
                <a
                  href={getPlacePublicUrl({ status: place.status, slug: place.slug ?? null })!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  Открыть на сайте
                </a>
              ) : (
                <div className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-500 text-sm font-medium rounded-md cursor-not-allowed">
                  <ExternalLink className="w-4 h-4" />
                  Не опубликовано
                </div>
              )}
              
              {/* Secondary CTA: Admin technical access */}
              <a
                href={`/admin/content/places/${place.id}`}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
              >
                Открыть в админке
              </a>
            </div>

            {/* Danger Zone */}
            <div className="mt-6 pt-4 border-t">
              <PlaceDangerZone
                placeId={place.id}
                placeTitle={place.title}
                canDelete={canDeletePlace}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
