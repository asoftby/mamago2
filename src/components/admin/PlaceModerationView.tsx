"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Phone, Globe, Instagram, ArrowLeft, ExternalLink } from "lucide-react";
import { formatDistance } from "@/lib/formatDistance";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { formatAgeKeys } from "@/lib/config/ages";
import { getPlacePublicUrl } from "@/lib/placePublicUrl";
import { PlaceDangerZone } from "@/components/admin/moderation/PlaceDangerZone";
import { Textarea } from "@/components/ui/textarea";

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
    formattedAddr?: string | null;
    customAddress?: string | null;
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
    lat?: number | null;
    lng?: number | null;
    phone?: string | null;
    website?: string | null;
    instagramHandle?: string | null;
    instagramUrl?: string | null;
    ageTags: string[];
    visitFormats: string[];
    activityTypes: string[];
    slug?: string | null;
    shortAddress?: string | null;
    owner?: { business: { name: string } | null } | null;
    createdAt: Date;
  };
}

export function PlaceModerationView({ place }: PlaceModerationViewProps) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const statusConfig = STATUS_CONFIG[place.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.DRAFT;

  // Get display values
  const displayAddress = place.formattedAddr || place.customAddress || "Адрес не указан";
  const districtName = place.districtManual?.name ?? place.districtAuto?.name;
  const metroName = place.metroManual?.name ?? place.metroAuto?.name;
  const metroDistance = place.metroManualDistanceM ?? place.metroAutoDistanceM;
  const cityHasMetro = place.city?.hasMetro ?? false;
  const metroMaxDistance = place.city?.metroMaxDistanceM ?? 2500;

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
            href="/admin/moderation/queue"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to queue
          </Link>
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/editor/place/${place.id}/edit?returnTo=${encodeURIComponent(`/admin/content/places/${place.id}`)}`}
            >
              Открыть в редакторе
            </Link>
          </Button>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Place Moderation</h1>
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
            <p className="text-lg text-gray-600">{place.shortDesc}</p>
          </div>

          {/* Description */}
          {place.description && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Описание</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{place.description}</p>
            </div>
          )}

          {/* Location */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Местоположение</h3>
            <div className="space-y-2">
              <p className="text-gray-700">{displayAddress}</p>

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
                  Coordinates: {place.lat.toFixed(6)}, {place.lng.toFixed(6)}
                </p>
              )}
            </div>
          </div>

          {/* Contacts */}
          {(place.phone || place.website || place.instagramHandle) && (
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

                {place.instagramHandle && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <Instagram className="w-4 h-4" />
                    <a
                      href={place.instagramUrl || `https://instagram.com/${place.instagramHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600"
                    >
                      @{place.instagramHandle}
                    </a>
                  </div>
                )}
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
                    <span className="text-sm text-gray-700">{place.visitFormats.join(", ")}</span>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Moderation</h3>

            {/* Place Info */}
            <div className="space-y-3 mb-6 pb-6 border-b">
              <div>
                <span className="text-sm font-medium text-gray-600">Status:</span>
                <div className="mt-1">
                  <Badge variant={statusConfig.variant} className={statusConfig.className}>{statusConfig.label}</Badge>
                </div>
              </div>

              <div>
                <span className="text-sm font-medium text-gray-600">Type:</span>
                <p className="text-sm text-gray-900 mt-1">Place</p>
              </div>

              {place.city && (
                <div>
                  <span className="text-sm font-medium text-gray-600">City:</span>
                  <p className="text-sm text-gray-900 mt-1">{place.city.name}</p>
                </div>
              )}

              {place.owner?.business && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Business:</span>
                  <p className="text-sm text-gray-900 mt-1">{place.owner.business.name}</p>
                </div>
              )}

              <div>
                <span className="text-sm font-medium text-gray-600">Submitted:</span>
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
                {isSubmitting ? "Processing..." : "Approve"}
              </Button>

              <Button
                onClick={() => handleModerate("NEEDS_REVISION")}
                disabled={isSubmitting || !comment.trim()}
                variant="outline"
                className="w-full"
              >
                Needs Revision
              </Button>

              <Button
                onClick={() => handleModerate("REJECT")}
                disabled={isSubmitting}
                variant="destructive"
                className="w-full"
              >
                Reject
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
                href={`/admin/places/${place.id}`}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50"
              >
                Открыть в админке
              </a>
            </div>

            {/* Danger Zone */}
            <div className="mt-6 pt-4 border-t">
              <PlaceDangerZone placeId={place.id} placeTitle={place.title} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
