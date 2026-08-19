/**
 * Place Revision Moderation View
 * Shows diff between published Place and pending revision
 */

"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Navigation, ExternalLink } from "lucide-react";
import { formatDistance } from "@/lib/formatDistance";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "@/lib/toast";
import {
  compareFields,
  compareImages,
  generateDiffSummary,
  getChangedFields,
} from "@/lib/moderation/diffUtils";
import { DiffSummary } from "./moderation/DiffSummary";
import { FieldDiff } from "./moderation/FieldDiff";
import { ImageDiff } from "./moderation/ImageDiff";
import { MicroEditHistory } from "./moderation/MicroEditHistory";
import { PlaceGroupDiff } from "./moderation/PlaceGroupDiff";
import { OpeningHoursDiff } from "./moderation/OpeningHoursDiff";
import { getPlacePublicUrl } from "@/lib/placePublicUrl";
import { PlaceDangerZone } from "./moderation/PlaceDangerZone";
import { Textarea } from "@/components/ui/textarea";
import type { OpeningHoursWithRelations } from "@/server/services/openingHours/openingHours.types";
import { GoogleReviewsStatusBadge } from "@/components/admin/moderation/GoogleReviewsStatusBadge";
import { FaqReadonlySection } from "@/components/admin/moderation/FaqReadonlySection";
import { getPlaceDetailBackLink } from "@/lib/admin/placeDetailNavigation";

interface PlaceRevisionModerationViewProps {
  place: {
    id: string;
    title: string;
    updatedAt: Date;
    images?: Array<{ id: string; url: string; kind: string; sortOrder?: number }>;
    openingHours?: OpeningHoursWithRelations | null;
    city?: { id: string; name: string; hasMetro?: boolean | null; metroMaxDistanceM?: number | null } | null;
    createdBy?: { business: { name: string } | null } | null;
    ownerBusiness?: { id: string; name: string } | null;
    status: string;
    slug?: string | null;
    districtManual?: { name: string } | null;
    districtAuto?: { name: string } | null;
    metroManual?: { name: string } | null;
    metroAuto?: { name: string } | null;
    metroManualDistanceM?: number | null;
    metroAutoDistanceM?: number | null;
    displayAddress?: string | null;
    formattedAddr?: string | null;
    customAddress?: string | null;
    locationName?: string | null;
    directionsNote?: string | null;
    placeKind?: string | null;
    floor?: string | null;
    unit?: string | null;
    unitLabel?: string | null;
    shortDesc?: string | null;
    description?: string | null;
    faqItems?: unknown;
    category?: string | null;
    phone?: string | null;
    website?: string | null;
    instagramHandle?: string | null;
    instagramUrl?: string | null;
    ageTags?: string[];
    visitFormats?: string[];
    activityTypes?: string[];
    placeGroupId?: string | null;
    lat?: number | null;
    lng?: number | null;
    googlePlaceId?: string | null;
    googleRating?: number | null;
    googleUserRatingsTotal?: number | null;
    googleReviewsJson?: unknown;
    [key: string]: unknown;
  };
  revision: {
    id: string;
    title: string | null;
    status: string;
    createdAt: Date;
    submittedAt?: Date | null;
    images?: Array<{ id: string; url: string; kind: string; sortOrder?: number }>;
    openingHours?: OpeningHoursWithRelations | null;
    ageTags: string[];
    visitFormats: string[];
    activityTypes: string[];
    city?: { id: string; name: string } | null;
    districtManual?: { name: string } | null;
    districtAuto?: { name: string } | null;
    districtManualId?: string | null;
    districtAutoId?: string | null;
    metroManual?: { name: string } | null;
    metroAuto?: { name: string } | null;
    metroManualId?: string | null;
    metroAutoId?: string | null;
    metroManualDistanceM?: number | null;
    metroAutoDistanceM?: number | null;
    displayAddress?: string | null;
    formattedAddr?: string | null;
    customAddress?: string | null;
    locationName?: string | null;
    directionsNote?: string | null;
    placeKind?: string | null;
    floor?: string | null;
    unit?: string | null;
    unitLabel?: string | null;
    shortDesc?: string | null;
    description?: string | null;
    faqItems?: unknown;
    category?: string | null;
    phone?: string | null;
    website?: string | null;
    instagramHandle?: string | null;
    instagramUrl?: string | null;
    placeGroupId?: string | null;
    lat?: number | null;
    lng?: number | null;
    moderatorComment?: string | null;
    reviewedAt?: Date | null;
    revisionRequestedAt?: Date | null;
    revisionResubmittedAt?: Date | null;
    [key: string]: unknown;
  };
  canDeletePlace?: boolean;
}

const BLOCK_FIELDS = {
  basic: ["title", "shortDesc", "description", "category", "placeKind"],
  location: [
    "formattedAddr",
    "displayAddress",
    "locationName",
    "directionsNote",
    "floor",
    "unit",
    "cityName",
    "districtName",
    "metroName",
    "placeGroupId",
  ],
  geo: ["lat", "lng"],
  contacts: ["phone", "website", "instagramUrl", "instagramHandle"],
  reviewMeta: [
    "moderatorComment",
    "reviewedAt",
    "revisionRequestedAt",
    "revisionResubmittedAt",
  ],
} as const;

export function PlaceRevisionModerationView({
  place,
  revision,
  canDeletePlace = false,
}: PlaceRevisionModerationViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [microEdits, setMicroEdits] = useState<Array<{ id: string; fieldName: string; oldValue: string | null; newValue: string | null; editType: string; comment: string | null; createdAt: string; moderator: { email: string } }>>([]);
  const [displayTitle, setDisplayTitle] = useState<string>(place.title);
  const [hasDuplicates, setHasDuplicates] = useState<boolean>(false);
  const backLink = getPlaceDetailBackLink(searchParams.get("returnTo"));
  const effectiveFaqItems = revision.faqItems !== undefined ? revision.faqItems : place.faqItems;

  // Fetch micro-edits for this place
  useEffect(() => {
    const fetchMicroEdits = async () => {
      try {
        const response = await fetch(`/api/admin/places/${place.id}/micro-edit`);
        if (response.ok) {
          const data = await response.json();
          setMicroEdits(data.edits || []);
        }
      } catch (error) {
        console.error("Failed to fetch micro-edits:", error);
      }
    };

    fetchMicroEdits();
  }, [place.id]);

  // Fetch display title and duplicate info
  useEffect(() => {
    const fetchDisplayInfo = async () => {
      try {
        const response = await fetch(`/api/admin/places/${place.id}/display-info`);
        if (response.ok) {
          const data = await response.json();
          setDisplayTitle(data.displayTitle);
          setHasDuplicates(data.hasDuplicates);
        }
      } catch (error) {
        console.error("Failed to fetch display info:", error);
      }
    };

    fetchDisplayInfo();
  }, [place.id]);

  // Compute diff
  const diff = useMemo(() => {
    const fieldConfig = [
      { field: "title" as const, label: "Название" },
      { field: "shortDesc" as const, label: "Краткое описание" },
      { field: "description" as const, label: "Полное описание" },
      { field: "category" as const, label: "Категория" },
      { field: "placeKind" as const, label: "Тип места" },
      { field: "formattedAddr" as const, label: "Адрес" },
      { field: "displayAddress" as const, label: "Адрес для показа" },
      { field: "customAddress" as const, label: "Дополнительный адрес" },
      { field: "locationName" as const, label: "Ориентир" },
      { field: "directionsNote" as const, label: "Как найти" },
      { field: "floor" as const, label: "Этаж" },
      { field: "unit" as const, label: "Помещение / кабинет" },
      { field: "cityName" as const, label: "Город" },
      { field: "districtName" as const, label: "Район" },
      { field: "metroName" as const, label: "Метро" },
      { field: "lat" as const, label: "Широта" },
      { field: "lng" as const, label: "Долгота" },
      { field: "phone" as const, label: "Телефон" },
      { field: "website" as const, label: "Веб-сайт" },
      { field: "instagramUrl" as const, label: "Instagram URL" },
      { field: "instagramHandle" as const, label: "Instagram" },
      { field: "ageTags" as const, label: "Возрастные группы" },
      { field: "visitFormats" as const, label: "Форматы посещения" },
      { field: "activityTypes" as const, label: "Типы активностей" },
      { field: "placeGroupId" as const, label: "Принадлежность к сети" },
      { field: "moderatorComment" as const, label: "Комментарий модератора" },
      { field: "reviewedAt" as const, label: "Последний review" },
      { field: "revisionRequestedAt" as const, label: "Правки запрошены" },
      { field: "revisionResubmittedAt" as const, label: "Правки повторно отправлены" },
    ];

    const placeDistrictName = place.districtManual?.name ?? place.districtAuto?.name ?? null;
    const revisionDistrictName =
      revision.districtManual?.name ?? revision.districtAuto?.name ?? placeDistrictName;
    const placeMetroName = place.metroManual?.name ?? place.metroAuto?.name ?? null;
    const revisionMetroName =
      revision.metroManual?.name ?? revision.metroAuto?.name ?? placeMetroName;

    const oldData = {
      title: place.title,
      shortDesc: place.shortDesc,
      description: place.description,
      category: place.category,
      placeKind: place.placeKind,
      formattedAddr: place.formattedAddr,
      displayAddress: place.displayAddress,
      customAddress: place.customAddress,
      locationName: place.locationName,
      directionsNote: place.directionsNote,
      floor: place.floor,
      unit: place.unit,
      cityName: place.city?.name ?? null,
      districtName: placeDistrictName,
      metroName: placeMetroName,
      lat: place.lat,
      lng: place.lng,
      phone: place.phone,
      website: place.website,
      instagramUrl: place.instagramUrl,
      instagramHandle: place.instagramHandle,
      ageTags: place.ageTags ?? [],
      visitFormats: place.visitFormats ?? [],
      activityTypes: place.activityTypes ?? [],
      placeGroupId: place.placeGroupId,
      moderatorComment: null,
      reviewedAt: null,
      revisionRequestedAt: null,
      revisionResubmittedAt: null,
    };

    const newData = {
      title: revision.title !== null ? revision.title : place.title,
      shortDesc: revision.shortDesc !== null ? revision.shortDesc : place.shortDesc,
      description: revision.description !== null ? revision.description : place.description,
      category: revision.category !== null ? revision.category : place.category,
      placeKind: revision.placeKind !== null ? revision.placeKind : place.placeKind,
      formattedAddr: revision.formattedAddr !== null ? revision.formattedAddr : place.formattedAddr,
      displayAddress: revision.displayAddress !== null ? revision.displayAddress : place.displayAddress,
      customAddress: revision.customAddress !== null ? revision.customAddress : place.customAddress,
      locationName: revision.locationName !== null ? revision.locationName : place.locationName,
      directionsNote: revision.directionsNote !== null ? revision.directionsNote : place.directionsNote,
      floor: revision.floor !== null ? revision.floor : place.floor,
      unit: revision.unit !== null ? revision.unit : place.unit,
      cityName: revision.city?.name ?? place.city?.name ?? null,
      districtName: revisionDistrictName,
      metroName: revisionMetroName,
      lat: revision.lat !== null ? revision.lat : place.lat,
      lng: revision.lng !== null ? revision.lng : place.lng,
      phone: revision.phone !== null ? revision.phone : place.phone,
      website: revision.website !== null ? revision.website : place.website,
      instagramUrl: revision.instagramUrl !== null ? revision.instagramUrl : place.instagramUrl,
      instagramHandle: revision.instagramHandle !== null ? revision.instagramHandle : place.instagramHandle,
      ageTags: revision.ageTags.length > 0 ? revision.ageTags : place.ageTags ?? [],
      visitFormats: revision.visitFormats.length > 0 ? revision.visitFormats : place.visitFormats ?? [],
      activityTypes: revision.activityTypes.length > 0 ? revision.activityTypes : place.activityTypes ?? [],
      placeGroupId: revision.placeGroupId !== undefined ? revision.placeGroupId : place.placeGroupId,
      moderatorComment: revision.moderatorComment ?? null,
      reviewedAt: revision.reviewedAt ?? null,
      revisionRequestedAt: revision.revisionRequestedAt ?? null,
      revisionResubmittedAt: revision.revisionResubmittedAt ?? null,
    };

    // Compare fields
    const allFieldChanges = compareFields(oldData, newData, fieldConfig);
    const changedFields = getChangedFields(allFieldChanges);

    // Compare images
    const imageChanges = compareImages(place.images || [], revision.images || []);

    // Compare opening hours
    const oldOpeningHours = place.openingHours as OpeningHoursWithRelations | null;
    const newOpeningHours = revision.openingHours as OpeningHoursWithRelations | null;
    
    let openingHoursChange: { 
      changeType: "added" | "removed" | "modified" | null;
      oldOpeningHours: OpeningHoursWithRelations | null;
      newOpeningHours: OpeningHoursWithRelations | null;
    } = {
      changeType: null,
      oldOpeningHours: null,
      newOpeningHours: null,
    };

    if (!oldOpeningHours && newOpeningHours) {
      // Opening hours added
      openingHoursChange = {
        changeType: "added",
        oldOpeningHours: null,
        newOpeningHours,
      };
    } else if (oldOpeningHours && !newOpeningHours) {
      // Opening hours removed
      openingHoursChange = {
        changeType: "removed",
        oldOpeningHours,
        newOpeningHours: null,
      };
    } else if (oldOpeningHours && newOpeningHours) {
      // Check if opening hours are different
      const isModified = 
        oldOpeningHours.mode !== newOpeningHours.mode ||
        oldOpeningHours.note !== newOpeningHours.note ||
        oldOpeningHours.timezone !== newOpeningHours.timezone ||
        JSON.stringify(oldOpeningHours.rules) !== JSON.stringify(newOpeningHours.rules) ||
        JSON.stringify(oldOpeningHours.exceptions) !== JSON.stringify(newOpeningHours.exceptions);

      if (isModified) {
        openingHoursChange = {
          changeType: "modified",
          oldOpeningHours,
          newOpeningHours,
        };
      }
    }

    // Generate summary
    // Include opening hours change in changedFields count
    const changedFieldsCount = changedFields.length + (openingHoursChange.changeType ? 1 : 0);
    
    const baseSummary = generateDiffSummary(changedFields, imageChanges);
    const summary = {
      ...baseSummary,
      changedFields: changedFieldsCount, // Override with count that includes opening hours
      totalChanges: changedFieldsCount + baseSummary.addedPhotos + baseSummary.removedPhotos,
    };

    return {
      allFieldChanges,
      changedFields,
      imageChanges,
      openingHoursChange,
      summary,
    };
  }, [place, revision]);

  // Location info (from revision if changed, otherwise from place)
  const displayAddress =
    revision.displayAddress ??
    place.displayAddress ??
    revision.formattedAddr ??
    place.formattedAddr ??
    revision.customAddress ??
    place.customAddress ??
    "Адрес не указан";
  
  const districtName =
    (revision.districtManual as { name: string } | null)?.name ??
    (place.districtManual as { name: string } | null)?.name ??
    (revision.districtAuto as { name: string } | null)?.name ??
    (place.districtAuto as { name: string } | null)?.name;
  
  const metroName =
    (revision.metroManual as { name: string } | null)?.name ??
    (place.metroManual as { name: string } | null)?.name ??
    (revision.metroAuto as { name: string } | null)?.name ??
    (place.metroAuto as { name: string } | null)?.name;
  
  const metroDistance: number =
    (revision.metroManualDistanceM ?? 0) ||
    (place.metroManualDistanceM ?? 0) ||
    (revision.metroAutoDistanceM ?? 0) ||
    (place.metroAutoDistanceM ?? 0);

  const cityHasMetro = (place.city as { hasMetro?: boolean } | null)?.hasMetro ?? false;
  const metroMaxDistance = (place.city as { metroMaxDistanceM?: number } | null)?.metroMaxDistanceM ?? 2500;

  const shouldShowMetro =
    metroName &&
    cityHasMetro &&
    metroDistance !== 0 &&
    metroDistance <= metroMaxDistance;
  const businessName = place.ownerBusiness?.name ?? place.createdBy?.business?.name ?? null;
  const filterBlock = (fields: readonly string[]) =>
    diff.changedFields.filter((change) => fields.includes(change.field));
  const groupedChanges = {
    basic: filterBlock(BLOCK_FIELDS.basic),
    location: filterBlock(BLOCK_FIELDS.location),
    geo: filterBlock(BLOCK_FIELDS.geo),
    contacts: filterBlock(BLOCK_FIELDS.contacts),
    reviewMeta: filterBlock(BLOCK_FIELDS.reviewMeta),
  };
  const locationContext: string[] = [
    (revision.locationName ?? place.locationName) ? `Ориентир: ${revision.locationName ?? place.locationName}` : null,
    (revision.directionsNote ?? place.directionsNote)
      ? `Как найти: ${revision.directionsNote ?? place.directionsNote}`
      : null,
    (revision.floor ?? place.floor) ? `Этаж: ${revision.floor ?? place.floor}` : null,
    (revision.unit ?? place.unit)
      ? `${revision.unitLabel ?? place.unitLabel ?? "Помещение"}: ${revision.unit ?? place.unit}`
      : null,
  ].filter((value): value is string => Boolean(value));

  const handleModerate = async (
    action: "APPROVE" | "NEEDS_REVISION" | "REJECT"
  ) => {
    if ((action === "NEEDS_REVISION" || action === "REJECT") && !comment.trim()) {
      toast.error("Пожалуйста, укажите причину");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/admin/moderation/places/${place.id}/revision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revisionId: revision.id,
            action,
            comment: comment.trim() || null,
          }),
        }
      );

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
        <Link
          href={backLink.href}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLink.label}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Проверка изменений места
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {revision.title ?? place.title}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/editor/place/${place.id}/edit?returnTo=${encodeURIComponent(`/admin/content/places/${place.id}`)}`}
              >
                Редактор
              </Link>
            </Button>
            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
              Revision Pending
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Changes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary */}
          <DiffSummary summary={diff.summary} />

          {/* No changes message */}
          {diff.summary.totalChanges === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-amber-900 mb-1">
                    Изменения не обнаружены
                  </h3>
                  <p className="text-sm text-amber-700">
                    Опубликованная версия места уже совпадает с данными в revision. 
                    Возможно, изменения были применены ранее, или revision был создан без изменений.
                  </p>
                  <p className="text-sm text-amber-700 mt-2">
                    Вы можете одобрить revision (это закроет его без изменений) или отклонить.
                  </p>
                </div>
              </div>
            </div>
          )}

          {groupedChanges.basic.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-gray-900">Основное</h2>
              <div className="space-y-4">
                {groupedChanges.basic.map((change) => (
                  <FieldDiff key={change.field} change={change} />
                ))}
              </div>
            </div>
          )}

          {groupedChanges.location.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-gray-900">Локация</h2>
              <div className="space-y-4">
                {groupedChanges.location.map((change) => {
                  if (change.field === "placeGroupId") {
                    return (
                      <PlaceGroupDiff
                        key={change.field}
                        oldGroupId={change.oldValue as string | null}
                        newGroupId={change.newValue as string | null}
                        placeId={place.id}
                        changeType={change.changeType}
                      />
                    );
                  }

                  return <FieldDiff key={change.field} change={change} />;
                })}
              </div>
            </div>
          )}

          {groupedChanges.geo.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-gray-900">Координаты</h2>
              <div className="space-y-4">
                {groupedChanges.geo.map((change) => (
                  <FieldDiff key={change.field} change={change} />
                ))}
              </div>
            </div>
          )}

          {groupedChanges.contacts.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-gray-900">Контакты</h2>
              <div className="space-y-4">
                {groupedChanges.contacts.map((change) => (
                  <FieldDiff key={change.field} change={change} />
                ))}
              </div>
            </div>
          )}

          {/* Image Changes */}
          {(diff.imageChanges.added.length > 0 ||
            diff.imageChanges.removed.length > 0) && (
            <ImageDiff changes={diff.imageChanges} />
          )}

          {/* Opening Hours Changes */}
          {diff.openingHoursChange.changeType && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Режим работы
              </h2>
              <OpeningHoursDiff
                oldOpeningHours={diff.openingHoursChange.oldOpeningHours}
                newOpeningHours={diff.openingHoursChange.newOpeningHours}
                changeType={diff.openingHoursChange.changeType}
              />
            </div>
          )}

          {/* Location Info (context) */}
          {(districtName || shouldShowMetro || locationContext.length > 0) && (
            <div className="border border-gray-200 rounded-lg p-4 bg-white">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Местоположение
              </h3>
              <p className="text-sm text-gray-700 mb-3">{displayAddress}</p>
              {locationContext.length > 0 && (
                <div className="mb-3 space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                  {locationContext.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              )}
              <div className="mb-3">
                <GoogleReviewsStatusBadge
                  googlePlaceId={place.googlePlaceId}
                  googleRating={place.googleRating}
                  googleUserRatingsTotal={place.googleUserRatingsTotal}
                  googleReviewsJson={place.googleReviewsJson}
                />
              </div>
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
            </div>
          )}

          <FaqReadonlySection items={effectiveFaqItems} />

          {groupedChanges.reviewMeta.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-gray-900">История review</h2>
              <div className="space-y-4">
                {groupedChanges.reviewMeta.map((change) => (
                  <FieldDiff key={change.field} change={change} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Moderation Panel (Sticky) */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Модерация
            </h3>

            {/* Revision Info */}
            <div className="space-y-3 mb-6 pb-6 border-b">
              <div>
                <span className="text-sm font-medium text-gray-600">Тип:</span>
                <p className="text-sm text-gray-900 mt-1">Изменения места</p>
              </div>

              {place.city && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Город:</span>
                  <p className="text-sm text-gray-900 mt-1">{place.city.name}</p>
                </div>
              )}

              {businessName && (
                <div>
                  <span className="text-sm font-medium text-gray-600">
                    Бизнес:
                  </span>
                  <p className="text-sm text-gray-900 mt-1">
                    {businessName}
                  </p>
                </div>
              )}

              <div>
                <span className="text-sm font-medium text-gray-600">
                  Отправлено:
                </span>
                <p className="text-sm text-gray-900 mt-1">
                  {revision.submittedAt
                    ? formatDistanceToNow(revision.submittedAt, {
                        addSuffix: true,
                        locale: ru,
                      })
                    : "—"}
                </p>
              </div>

              <div>
                <span className="text-sm font-medium text-gray-600">
                  Изменений:
                </span>
                <p className="text-sm text-gray-900 mt-1">
                  {diff.summary.totalChanges} total
                </p>
              </div>

              {revision.reviewedAt && (
                <div>
                  <span className="text-sm font-medium text-gray-600">
                    Проверено:
                  </span>
                  <p className="text-sm text-gray-900 mt-1">
                    {formatDistanceToNow(revision.reviewedAt, {
                      addSuffix: true,
                      locale: ru,
                    })}
                  </p>
                </div>
              )}

              {revision.revisionRequestedAt && (
                <div>
                  <span className="text-sm font-medium text-gray-600">
                    Запрос доработки:
                  </span>
                  <p className="text-sm text-gray-900 mt-1">
                    {formatDistanceToNow(revision.revisionRequestedAt, {
                      addSuffix: true,
                      locale: ru,
                    })}
                  </p>
                </div>
              )}

              {revision.revisionResubmittedAt && (
                <div>
                  <span className="text-sm font-medium text-gray-600">
                    Переотправлено:
                  </span>
                  <p className="text-sm text-gray-900 mt-1">
                    {formatDistanceToNow(revision.revisionResubmittedAt, {
                      addSuffix: true,
                      locale: ru,
                    })}
                  </p>
                </div>
              )}

              {/* Display Title Info */}
              <div>
                <span className="text-sm font-medium text-gray-600">
                  Публичное название:
                </span>
                <p className="text-sm text-gray-900 mt-1 font-medium">
                  {displayTitle}
                </p>
                {hasDuplicates && (
                  <p className="text-xs text-amber-600 mt-1">
                    Название конфликтует с другими местами в городе. Для различения используется адрес.
                  </p>
                )}
              </div>
            </div>

            {/* Micro-Edit History */}
            {microEdits.length > 0 && (
              <div className="mb-6 pb-6 border-b">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Редакторские правки
                </h4>
                <MicroEditHistory edits={microEdits} />
              </div>
            )}

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
              <p className="text-xs text-gray-500 mt-1">
                Для ссылки на фото используйте: &quot;Фото №1&quot;, &quot;Фото №2&quot; и т.д.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                onClick={() => handleModerate("APPROVE")}
                disabled={isSubmitting}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? "Обработка..." : diff.summary.totalChanges === 0 ? "Одобрить без изменений" : "Одобрить изменения"}
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

            {/* View Published Place Actions */}
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
