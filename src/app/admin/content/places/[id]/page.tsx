import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { PlaceModerationView } from "@/components/admin/PlaceModerationView";
import { PlaceRevisionModerationView } from "@/components/admin/PlaceRevisionModerationView";
import { ImprovementRequestForm } from "@/components/admin/moderation/ImprovementRequestForm";
import { ImprovementRequestList, type ImprovementRequest } from "@/components/admin/moderation/ImprovementRequestList";
import { PlaceDangerZone } from "@/components/admin/moderation/PlaceDangerZone";
import { PlacePreviewCard } from "@/components/admin/moderation/PlacePreviewCard";
import { PlaceModerationSidebar } from "@/components/admin/moderation/PlaceModerationSidebar";
import { getPlacePublicUrl } from "@/lib/placePublicUrl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { PlaceFormData } from "@/components/business/wizard/place/types";
import { ContentStatus, PlaceKind } from "@prisma/client";
import Link from "next/link";
import { getPlaceDetailBackLink } from "@/lib/admin/placeDetailNavigation";
import {
  loadImprovementRequestsForPlace,
  loadPendingPlaceRevision,
  loadPlaceForBasicModeration,
  loadPlaceForPublishedAdmin,
} from "./placeModerationQueries";

export default async function PlaceModerationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; returnTo?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    redirect("/login");
  }

  const { id } = await params;
  const { mode, returnTo } = await searchParams;
  const backLink = getPlaceDetailBackLink(returnTo);

  const place = await loadPlaceForBasicModeration(id);

  if (!place) {
    notFound();
  }

  if (place.status === "PENDING") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <PlaceModerationView place={place} />
        </div>
      </div>
    );
  }

  // Check if we should show revision mode
  const shouldShowRevision = mode === "revision" || place.status === "PUBLISHED";

  if (shouldShowRevision) {
    const fullPlace = await loadPlaceForPublishedAdmin(id);

    if (!fullPlace) {
      notFound();
    }

    const revision = await loadPendingPlaceRevision(fullPlace.id);

    if (revision && revision.status === "PENDING") {
      // Show revision moderation view
      return <PlaceRevisionModerationView place={fullPlace} revision={revision} />;
    }

    // If place is PUBLISHED but no pending revision, show improvement request form
    if (fullPlace.status === "PUBLISHED") {
      const improvementRequests = await loadImprovementRequestsForPlace(fullPlace.id);

      const publicUrl = getPlacePublicUrl(fullPlace);

      // Map place to form data for completion calculation
      const placeFormData: PlaceFormData = {
        id: fullPlace.id,
        ownerBusinessId: fullPlace.ownerBusinessId,
        status: fullPlace.status as ContentStatus,
        title: fullPlace.title,
        category: fullPlace.category,
        shortDesc: fullPlace.shortDesc,
        description: fullPlace.description,
        ageTags: fullPlace.ageTags || [],
        visitFormats: fullPlace.visitFormats || [],
        primaryCategoryId: fullPlace.primaryCategoryId ?? null,
        subcategoryIds: [],
        lat: fullPlace.lat,
        lng: fullPlace.lng,
        googlePlaceId: fullPlace.googlePlaceId,
        formattedAddr: fullPlace.formattedAddr,
        addressJson: fullPlace.addressJson,
        customAddress: fullPlace.customAddress,
        cityId: fullPlace.cityId,
        districtAutoId: fullPlace.districtAutoId,
        districtManualId: fullPlace.districtManualId,
        metroAutoId: fullPlace.metroAutoId,
        metroAutoDistanceM: fullPlace.metroAutoDistanceM,
        metroManualId: fullPlace.metroManualId,
        metroManualDistanceM: fullPlace.metroManualDistanceM,
        phone: fullPlace.phone,
        phoneLabel: fullPlace.phoneLabel,
        phone2: fullPlace.phone2,
        phone2Label: fullPlace.phone2Label,
        phone3: fullPlace.phone3,
        phone3Label: fullPlace.phone3Label,
        website: fullPlace.website,
        instagramHandle: fullPlace.instagramHandle,
        instagramUrl: fullPlace.instagramUrl,
        logoImageId: fullPlace.logoImageId,
        logoUrl: fullPlace.images.find(img => img.kind === "LOGO")?.url || null,
        images: fullPlace.images.map(img => ({
          id: img.id,
          url: img.url,
          kind: img.kind as "LOGO" | "GALLERY",
          order: img.sortOrder,
          width: img.width || 0,
          height: img.height || 0,
          blurhash: img.blurhash || null,
          sortOrder: img.sortOrder,
        })),
        openingHoursId: fullPlace.openingHoursId,
        openingHoursData: fullPlace.openingHours ? {
          mode: fullPlace.openingHours.mode as import("@prisma/client").OpeningHoursMode,
          timezone: fullPlace.openingHours.timezone || "Europe/Minsk",
          rules: fullPlace.openingHours.rules?.map(rule => ({
            dayOfWeek: rule.dayOfWeek,
            isOpen: rule.isOpen,
            allDay: rule.allDay || false,
            intervals: rule.intervals?.map(int => ({
              startTime: int.startTime,
              endTime: int.endTime,
            })) || [],
          })) || [],
        } : null,
        placeKind: fullPlace.placeKind as PlaceKind,
        floor: fullPlace.floor,
        unit: fullPlace.unit,
        priceItems: { items: [], note: "" },
        createdAt: fullPlace.createdAt,
        updatedAt: fullPlace.updatedAt,
      };

      const STATUS_LABELS: Record<string, { label: string; color: string }> = {
        PUBLISHED: { label: "Опубликовано", color: "bg-green-100 text-green-800" },
      };

      const statusInfo = STATUS_LABELS[fullPlace.status] || {
        label: fullPlace.status,
        color: "bg-gray-100 text-gray-800",
      };

      return (
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <div className="bg-white border-b">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <Link
                  href={backLink.href}
                  className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  {backLink.label}
                </Link>
              </div>

              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-gray-900">
                      {fullPlace.title}
                    </h1>
                    <Badge className={statusInfo.color}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                  {fullPlace.formattedAddr && (
                    <p className="text-gray-600">{fullPlace.formattedAddr}</p>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
              {/* Left Column - Place Preview */}
              <div>
                <PlacePreviewCard place={fullPlace} />
              </div>

              {/* Right Column - Moderation Sidebar */}
              <div>
                <PlaceModerationSidebar
                  place={{
                    id: fullPlace.id,
                    title: fullPlace.title,
                    status: fullPlace.status,
                    slug: fullPlace.slug,
                    formattedAddr: fullPlace.formattedAddr,
                    owner: fullPlace.createdBy,
                    city: fullPlace.city ? {
                      id: parseInt(fullPlace.city.id),
                      name: fullPlace.city.name,
                    } : null,
                  }}
                  placeFormData={placeFormData}
                  publicUrl={publicUrl}
                />
              </div>
            </div>

            {/* Improvement Requests Section */}
            <div className="mt-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Запросы на доработку
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Create Form */}
                <Card>
                  <CardHeader>
                    <CardTitle>Создать запрос</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ImprovementRequestForm placeId={place.id} />
                    
                  </CardContent>
                </Card>

                {/* History */}
                <Card>
                  <CardHeader>
                    <CardTitle>История запросов</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {improvementRequests.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>Запросов на доработку пока нет</p>
                      </div>
                    ) : (
                      <ImprovementRequestList requests={improvementRequests as ImprovementRequest[]} />
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="mt-8">
              <PlaceDangerZone placeId={place.id} placeTitle={place.title} />
            </div>
          </div>
        </div>
      );
    }
  }

  const fullPlace = await loadPlaceForPublishedAdmin(id);

  if (!fullPlace) {
    notFound();
  }

  const publicUrl = getPlacePublicUrl(fullPlace);
  const placeFormData: PlaceFormData = {
    id: fullPlace.id,
    ownerBusinessId: fullPlace.ownerBusinessId,
    status: fullPlace.status as ContentStatus,
    title: fullPlace.title,
    category: fullPlace.category,
    shortDesc: fullPlace.shortDesc,
    description: fullPlace.description,
    ageTags: fullPlace.ageTags || [],
    visitFormats: fullPlace.visitFormats || [],
    primaryCategoryId: fullPlace.primaryCategoryId ?? null,
    subcategoryIds: [],
    lat: fullPlace.lat,
    lng: fullPlace.lng,
    googlePlaceId: fullPlace.googlePlaceId,
    formattedAddr: fullPlace.formattedAddr,
    addressJson: fullPlace.addressJson,
    customAddress: fullPlace.customAddress,
    cityId: fullPlace.cityId,
    districtAutoId: fullPlace.districtAutoId,
    districtManualId: fullPlace.districtManualId,
    metroAutoId: fullPlace.metroAutoId,
    metroAutoDistanceM: fullPlace.metroAutoDistanceM,
    metroManualId: fullPlace.metroManualId,
    metroManualDistanceM: fullPlace.metroManualDistanceM,
    phone: fullPlace.phone,
    phoneLabel: fullPlace.phoneLabel,
    phone2: fullPlace.phone2,
    phone2Label: fullPlace.phone2Label,
    phone3: fullPlace.phone3,
    phone3Label: fullPlace.phone3Label,
    website: fullPlace.website,
    instagramHandle: fullPlace.instagramHandle,
    instagramUrl: fullPlace.instagramUrl,
    logoImageId: fullPlace.logoImageId,
    logoUrl: fullPlace.images.find((img) => img.kind === "LOGO")?.url || null,
    images: fullPlace.images.map((img) => ({
      id: img.id,
      url: img.url,
      kind: img.kind as "LOGO" | "GALLERY",
      order: img.sortOrder,
      width: img.width || 0,
      height: img.height || 0,
      blurhash: img.blurhash || null,
      sortOrder: img.sortOrder,
    })),
    openingHoursId: fullPlace.openingHoursId,
    openingHoursData: fullPlace.openingHours
      ? {
          mode: fullPlace.openingHours.mode as import("@prisma/client").OpeningHoursMode,
          timezone: fullPlace.openingHours.timezone || "Europe/Minsk",
          rules: fullPlace.openingHours.rules?.map((rule) => ({
            dayOfWeek: rule.dayOfWeek,
            isOpen: rule.isOpen,
            allDay: rule.allDay || false,
            intervals:
              rule.intervals?.map((int) => ({
                startTime: int.startTime,
                endTime: int.endTime,
              })) || [],
          })) || [],
        }
      : null,
    placeKind: fullPlace.placeKind as PlaceKind,
    floor: fullPlace.floor,
    unit: fullPlace.unit,
    priceItems: { items: [], note: "" },
    createdAt: fullPlace.createdAt,
    updatedAt: fullPlace.updatedAt,
  };

  const statusInfo = {
    label: place.status,
    color: "bg-gray-100 text-gray-800",
  };

  // Show non-moderation management preview for DRAFT / NEEDS_REVISION / REJECTED without pending revision
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/admin/content/places"
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Назад к списку
            </Link>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{fullPlace.title}</h1>
                <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
              </div>
              {fullPlace.formattedAddr && (
                <p className="text-gray-600">{fullPlace.formattedAddr}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <div>
            <PlacePreviewCard place={fullPlace} />
          </div>
          <div>
            <PlaceModerationSidebar
              place={{
                id: fullPlace.id,
                title: fullPlace.title,
                status: fullPlace.status,
                slug: fullPlace.slug,
                formattedAddr: fullPlace.formattedAddr,
                owner: fullPlace.createdBy,
                city: fullPlace.city
                  ? {
                      id: parseInt(fullPlace.city.id),
                      name: fullPlace.city.name,
                    }
                  : null,
              }}
              placeFormData={placeFormData}
              publicUrl={publicUrl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
