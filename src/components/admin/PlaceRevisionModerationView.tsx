/**
 * Place Revision Moderation View
 * Shows diff between published Place and pending revision
 */

"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Navigation, ExternalLink } from "lucide-react";
import { formatDistance } from "@/lib/formatDistance";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
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

interface PlaceRevisionModerationViewProps {
  place: {
    id: string;
    title: string;
    updatedAt: Date;
    images?: Array<{ [key: string]: unknown }>;
    openingHours?: Record<string, unknown> | null;
    [key: string]: unknown;
  };
  revision: {
    id: string;
    title: string | null;
    status: string;
    createdAt: Date;
    submittedAt?: Date | null;
    images?: Array<{ [key: string]: unknown }>;
    openingHours?: Record<string, unknown> | null;
    ageTags: string[];
    visitFormats: string[];
    activityTypes: string[];
    [key: string]: unknown;
  };
}

export function PlaceRevisionModerationView({
  place,
  revision,
}: PlaceRevisionModerationViewProps) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [microEdits, setMicroEdits] = useState<Array<Record<string, unknown>>>([]);
  const [displayTitle, setDisplayTitle] = useState<string>(place.title);
  const [hasDuplicates, setHasDuplicates] = useState<boolean>(false);

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
    // DEBUG: Log raw data for investigation
    console.log("[PlaceRevisionModerationView] Computing diff:", {
      placeId: place.id,
      placeTitle: place.title,
      placeUpdatedAt: place.updatedAt,
      revisionId: revision.id,
      revisionTitle: revision.title,
      revisionStatus: revision.status,
      revisionCreatedAt: revision.createdAt,
      revisionSubmittedAt: revision.submittedAt,
    });

    // Field configuration for comparison
    const fieldConfig = [
      { field: "title" as const, label: "Название" },
      { field: "shortDesc" as const, label: "Краткое описание" },
      { field: "description" as const, label: "Полное описание" },
      { field: "category" as const, label: "Категория" },
      { field: "formattedAddr" as const, label: "Адрес" },
      { field: "customAddress" as const, label: "Дополнительный адрес" },
      { field: "phone" as const, label: "Телефон" },
      { field: "website" as const, label: "Веб-сайт" },
      { field: "instagramHandle" as const, label: "Instagram" },
      { field: "ageTags" as const, label: "Возрастные группы" },
      { field: "visitFormats" as const, label: "Форматы посещения" },
      { field: "activityTypes" as const, label: "Типы активностей" },
      { field: "placeGroupId" as const, label: "Принадлежность к сети" },
    ];

    // Prepare data for comparison
    // IMPORTANT: Revision fields can be null (meaning "not changed")
    // For diff, we need to compare actual values, not null-coalesced values
    // If revision field is null, it means no change was made to that field
    
    const oldData = {
      title: place.title,
      shortDesc: place.shortDesc,
      description: place.description,
      category: place.category,
      formattedAddr: place.formattedAddr,
      customAddress: place.customAddress,
      phone: place.phone,
      website: place.website,
      instagramHandle: place.instagramHandle,
      ageTags: place.ageTags,
      visitFormats: place.visitFormats,
      activityTypes: place.activityTypes,
      placeGroupId: place.placeGroupId,
    };

    // For newData, use revision value if it exists (not null), otherwise use place value
    // This correctly handles the case where revision.field === null means "unchanged"
    const newData = {
      title: revision.title !== null ? revision.title : place.title,
      shortDesc: revision.shortDesc !== null ? revision.shortDesc : place.shortDesc,
      description: revision.description !== null ? revision.description : place.description,
      category: revision.category !== null ? revision.category : place.category,
      formattedAddr: revision.formattedAddr !== null ? revision.formattedAddr : place.formattedAddr,
      customAddress: revision.customAddress !== null ? revision.customAddress : place.customAddress,
      phone: revision.phone !== null ? revision.phone : place.phone,
      website: revision.website !== null ? revision.website : place.website,
      instagramHandle: revision.instagramHandle !== null ? revision.instagramHandle : place.instagramHandle,
      ageTags: revision.ageTags.length > 0 ? revision.ageTags : place.ageTags,
      visitFormats: revision.visitFormats.length > 0 ? revision.visitFormats : place.visitFormats,
      activityTypes: revision.activityTypes.length > 0 ? revision.activityTypes : place.activityTypes,
      placeGroupId: revision.placeGroupId !== undefined ? revision.placeGroupId : place.placeGroupId,
    };

    // DEBUG: Log comparison data
    console.log("[PlaceRevisionModerationView] Comparison data:", {
      oldData,
      newData,
    });

    // Compare fields
    const allFieldChanges = compareFields(oldData, newData, fieldConfig);
    const changedFields = getChangedFields(allFieldChanges);

    // Compare images
    const imageChanges = compareImages(place.images || [], revision.images || []);

    // Compare opening hours
    const oldOpeningHours = place.openingHours;
    const newOpeningHours = revision.openingHours;
    
    let openingHoursChange: { 
      changeType: "added" | "removed" | "modified" | null;
      oldOpeningHours: Record<string, unknown> | null;
      newOpeningHours: Record<string, unknown> | null;
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

    // DEBUG: Log results
    console.log("[PlaceRevisionModerationView] Diff results:", {
      totalFields: allFieldChanges.length,
      changedFields: changedFields.length,
      changedFieldNames: changedFields.map(c => c.field),
      addedPhotos: imageChanges.added.length,
      removedPhotos: imageChanges.removed.length,
      openingHoursChangeType: openingHoursChange.changeType,
      totalChanges: summary.totalChanges,
    });

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
    revision.formattedAddr ?? place.formattedAddr ?? revision.customAddress ?? place.customAddress ?? "Адрес не указан";
  
  const districtName =
    revision.districtManual?.name ??
    place.districtManual?.name ??
    revision.districtAuto?.name ??
    place.districtAuto?.name;
  
  const metroName =
    revision.metroManual?.name ??
    place.metroManual?.name ??
    revision.metroAuto?.name ??
    place.metroAuto?.name;
  
  const metroDistance =
    revision.metroManualDistanceM ??
    place.metroManualDistanceM ??
    revision.metroAutoDistanceM ??
    place.metroAutoDistanceM;

  const cityHasMetro = place.city?.hasMetro ?? false;
  const metroMaxDistance = place.city?.metroMaxDistanceM ?? 2500;

  const shouldShowMetro =
    metroName &&
    metroDistance !== null &&
    cityHasMetro &&
    metroDistance <= metroMaxDistance;

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
          href="/admin/moderation/queue"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to queue
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Place Update Moderation
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

          {/* Changed Fields */}
          {diff.changedFields.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Изменённые поля
              </h2>
              <div className="space-y-4">
                {diff.changedFields.map((change) => {
                  // Use special component for placeGroupId
                  if (change.field === "placeGroupId") {
                    return (
                      <PlaceGroupDiff
                        key={change.field}
                        oldGroupId={change.oldValue}
                        newGroupId={change.newValue}
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

          {/* Location Info (if relevant) */}
          {(districtName || shouldShowMetro) && (
            <div className="border border-gray-200 rounded-lg p-4 bg-white">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Местоположение
              </h3>
              <p className="text-sm text-gray-700 mb-3">{displayAddress}</p>
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
        </div>

        {/* RIGHT COLUMN: Moderation Panel (Sticky) */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Moderation
            </h3>

            {/* Revision Info */}
            <div className="space-y-3 mb-6 pb-6 border-b">
              <div>
                <span className="text-sm font-medium text-gray-600">Type:</span>
                <p className="text-sm text-gray-900 mt-1">Place Update</p>
              </div>

              {place.city && (
                <div>
                  <span className="text-sm font-medium text-gray-600">City:</span>
                  <p className="text-sm text-gray-900 mt-1">{place.city.name}</p>
                </div>
              )}

              {place.owner.business && (
                <div>
                  <span className="text-sm font-medium text-gray-600">
                    Business:
                  </span>
                  <p className="text-sm text-gray-900 mt-1">
                    {place.owner.business.name}
                  </p>
                </div>
              )}

              <div>
                <span className="text-sm font-medium text-gray-600">
                  Submitted:
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
                  Changes:
                </span>
                <p className="text-sm text-gray-900 mt-1">
                  {diff.summary.totalChanges} total
                </p>
              </div>

              {/* Display Title Info */}
              <div>
                <span className="text-sm font-medium text-gray-600">
                  Public Display:
                </span>
                <p className="text-sm text-gray-900 mt-1 font-medium">
                  {displayTitle}
                </p>
                {hasDuplicates && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Title conflicts with other places in this city. Address added for disambiguation.
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
                {isSubmitting ? "Processing..." : diff.summary.totalChanges === 0 ? "Approve (No Changes)" : "Approve Changes"}
              </Button>

              <Button
                onClick={() => handleModerate("NEEDS_REVISION")}
                disabled={isSubmitting || !comment.trim()}
                variant="outline"
                className="w-full"
              >
                Request Changes
              </Button>

              <Button
                onClick={() => handleModerate("REJECT")}
                disabled={isSubmitting}
                variant="destructive"
                className="w-full"
              >
                Reject Update
              </Button>
            </div>

            {/* View Published Place Actions */}
            <div className="mt-6 pt-4 border-t space-y-2">
              {/* Primary CTA: Public place page */}
              {getPlacePublicUrl(place) ? (
                <a
                  href={getPlacePublicUrl(place)!}
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
