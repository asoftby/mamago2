"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ContentStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, MapPin, Archive, ArchiveRestore, AlertTriangle, Pencil, BarChart3 } from "lucide-react";
import { toast } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";
import { getPlaceSearchAddressMetaLine } from "@/lib/placeLocationString";
import { calculateUrgency } from "@/lib/improvementRequest/urgency";
import { CONTENT_STATUS_META } from "@/lib/content-status-meta";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import { cn } from "@/lib/utils";
import { isAppMediaUrl } from "@/lib/media/isAppMediaUrl";
import { resolvePlaceLogoImage } from "@/lib/place/resolvePlaceLogoImage";
import { PublicationStatisticsDialog } from "@/components/business/shared/PublicationStatisticsDialog";

interface PlaceCardData {
  id: string;
  title: string;
  shortAddress?: string | null;
  displayTitle?: string; // Optional pre-computed display title
  status: ContentStatus;
  formattedAddr: string | null;
  customAddress: string | null;
  slug: string | null;
  floor?: string | null;
  unit?: string | null;
  unitLabel?: string | null;
  moderatorComment: string | null;
  revisionRequestedAt: Date | null;
  archivedAt?: Date | null;
  logoImageId?: string | null;
  hasActiveImprovementRequests?: boolean;
  city?: {
    name: string;
    hasMetro: boolean;
    metroMaxDistanceM: number | null;
  } | null;
  images: Array<{
    id: string;
    url: string;
    kind: string;
  }>;
  activeRevision?: {
    id: string;
    status: string;
    moderatorComment: string | null;
    revisionRequestedAt: Date | null;
  } | null;
  improvementRequests?: Array<{
    id: string;
    status: string;
    severity: string;
    title: string;
    dueAt: Date | null;
  }>;
  updatedAt: Date;
}

interface PlaceCardHorizontalProps {
  place: PlaceCardData;
  onDelete?: (placeId: string) => void;
  onArchive?: (placeId: string) => void;
  onUnarchive?: (placeId: string) => void;
}

export function PlaceCardHorizontal({ place, onDelete, onArchive, onUnarchive }: PlaceCardHorizontalProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [statisticsOpen, setStatisticsOpen] = useState(false);

  const statusConfig = CONTENT_STATUS_META[place.status];
  
  // Determine effective status (revision takes precedence for display)
  const hasActiveRevision = place.activeRevision && 
    ["DRAFT", "PENDING", "NEEDS_REVISION"].includes(place.activeRevision.status);
  
  const displayStatus = hasActiveRevision && place.status === "PUBLISHED"
    ? place.activeRevision!.status
    : place.status;
  
  // Check for active improvement requests
  const activeImprovementRequests = place.improvementRequests?.filter(
    req => req.status === "OPEN" || req.status === "IN_PROGRESS"
  ) || [];
  
  const hasActiveImprovementRequest = activeImprovementRequests.length > 0 || place.hasActiveImprovementRequests;
  
  // Calculate most urgent improvement request
  let mostUrgentRequest = null;
  let mostUrgentUrgency = null;
  
  if (activeImprovementRequests.length > 0) {
    // Sort by urgency and severity
    const sorted = [...activeImprovementRequests].sort((a, b) => {
      const urgencyA = calculateUrgency(a.dueAt);
      const urgencyB = calculateUrgency(b.dueAt);
      
      if (urgencyA?.level === "overdue" && urgencyB?.level !== "overdue") return -1;
      if (urgencyA?.level !== "overdue" && urgencyB?.level === "overdue") return 1;
      if (urgencyA?.urgent && !urgencyB?.urgent) return -1;
      if (!urgencyA?.urgent && urgencyB?.urgent) return 1;
      
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      const severityA = severityOrder[a.severity as keyof typeof severityOrder] ?? 4;
      const severityB = severityOrder[b.severity as keyof typeof severityOrder] ?? 4;
      
      return severityA - severityB;
    });
    
    mostUrgentRequest = sorted[0];
    mostUrgentUrgency = calculateUrgency(mostUrgentRequest.dueAt);
  }
  
  // Get display values
  const displayTitle = place.displayTitle || place.title || "Без названия";
  const addressFormatted = getPlaceSearchAddressMetaLine({
    city: place.city ? { name: place.city.name } : null,
    shortAddress: place.shortAddress,
    formattedAddr: place.formattedAddr,
    customAddress: place.customAddress,
    floor: place.floor,
    unit: place.unit,
    unitLabel: place.unitLabel,
  });
  const displayAddress =
    addressFormatted !== "Место"
      ? addressFormatted
      : place.formattedAddr?.trim() ||
        place.customAddress?.trim() ||
        "Локация не задана";
  
  // Calculate days since revision request
  let daysSinceRevision: number | null = null;
  if (hasActiveRevision && place.activeRevision!.status === "NEEDS_REVISION" && place.activeRevision!.revisionRequestedAt) {
    const now = new Date();
    const requestedAt = new Date(place.activeRevision!.revisionRequestedAt);
    const diffMs = now.getTime() - requestedAt.getTime();
    daysSinceRevision = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } else if (place.status === "NEEDS_REVISION" && place.revisionRequestedAt) {
    const now = new Date();
    const requestedAt = new Date(place.revisionRequestedAt);
    const diffMs = now.getTime() - requestedAt.getTime();
    daysSinceRevision = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
  
  // Обложка: лого по logoImageId / kind LOGO, иначе первое фото
  const logoResolved = resolvePlaceLogoImage(place.images, place.logoImageId);
  const coverImage = logoResolved ?? place.images[0];

  const handleDelete = async () => {
    if (!onDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete(place.id);
      toast.success("Место удалено");
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Ошибка удаления");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchive = async () => {
    if (!onArchive) return;
    
    setIsArchiving(true);
    try {
      await onArchive(place.id);
      toast.success("Место перемещено в архив");
      setShowArchiveDialog(false);
    } catch (error) {
      console.error("Archive error:", error);
      toast.error("Ошибка архивации");
    } finally {
      setIsArchiving(false);
    }
  };

  const handleUnarchive = async () => {
    if (!onUnarchive) return;
    
    setIsArchiving(true);
    try {
      await onUnarchive(place.id);
      toast.success("Место восстановлено из архива");
    } catch (error) {
      console.error("Unarchive error:", error);
      toast.error("Ошибка восстановления");
    } finally {
      setIsArchiving(false);
    }
  };

  // Публичная карточка места на основном сайте (не на поддомене business)
  const publicBase = getCanonicalPublicAppUrl().replace(/\/+$/, "");
  const publicPath = place.slug?.trim()
    ? `/places/${place.slug.trim()}`
    : `/places/${place.id}`;
  const publicPlaceHref = `${publicBase}${publicPath}`;
  const actionButtonClass =
    "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-2xl px-3.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";
  const neutralActionClass =
    "border border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950";
  const iconActionClass =
    "h-10 w-10 shrink-0 rounded-2xl p-0 text-stone-500 hover:bg-stone-100 hover:text-stone-900";
  const placeMetrics = {
    views: 0,
    saves: 0,
    planAdds: 0,
    ctaClicks: 0,
  };

  return (
    <>
      <div className="group flex flex-col gap-4 rounded-[26px] border border-stone-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-stone-300 hover:shadow-[0_14px_32px_rgba(15,23,42,0.05)] md:flex-row md:items-center md:p-5">
        {/* Cover Image */}
        <Link href={publicPlaceHref} className="flex-shrink-0 self-start md:self-center">
          <div className="relative size-[86px] shrink-0 overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-200/70">
            {coverImage ? (
              isAppMediaUrl(coverImage.url) ? (
                <img
                  src={coverImage.url}
                  alt={displayTitle}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <Image
                  src={coverImage.url}
                  alt={displayTitle}
                  fill
                  unoptimized={isAppMediaUrl(coverImage.url)}
                  className="object-cover"
                  sizes="86px"
                />
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center text-stone-400">
                <MapPin className="h-7 w-7" />
              </div>
            )}
          </div>
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Link href={publicPlaceHref}>
            <h3 className="truncate text-lg font-semibold text-stone-950 transition-colors hover:text-stone-700">
              {displayTitle}
            </h3>
          </Link>
          
          <p className="mt-1 truncate text-sm text-stone-600">
            {displayAddress}
          </p>
          
          {/* Status badge - always show for non-archived places */}
          {!place.archivedAt && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium ${
                place.status === "DRAFT"
                  ? "border-stone-200 bg-stone-50 text-stone-600"
                  : place.status === "PENDING"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : place.status === "PENDING_UPDATE"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : place.status === "PUBLISHED"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : place.status === "NEEDS_REVISION"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : place.status === "SCHEDULED"
                  ? "border-blue-200 bg-blue-50 text-blue-900"
                  : place.status === "ARCHIVED"
                  ? "border-stone-200 bg-stone-50 text-stone-600"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}>
                {statusConfig.label}
              </span>
              
              {/* Improvement Request Indicator */}
              {hasActiveImprovementRequest && mostUrgentUrgency && (
                <Badge 
                  variant="outline" 
                  className={`rounded-full px-3 py-1.5 text-xs ${
                    mostUrgentUrgency.level === "overdue" 
                      ? "bg-red-50 text-red-700 border-red-300" 
                      : mostUrgentUrgency.urgent
                      ? "bg-orange-50 text-orange-700 border-orange-300"
                      : "bg-amber-50 text-amber-700 border-amber-300"
                  } flex items-center gap-1`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  {mostUrgentUrgency.level === "overdue" 
                    ? "Просрочено" 
                    : mostUrgentUrgency.urgent
                    ? "Требуются исправления"
                    : "Нужны правки"
                  }
                </Badge>
              )}
            </div>
          )}
          
          {/* Inactivity warning for NEEDS_REVISION */}
          {daysSinceRevision !== null && (
            <p className="mt-1 text-xs text-amber-700">
              Отправлено на доработку {daysSinceRevision} {daysSinceRevision === 1 ? "день" : daysSinceRevision < 5 ? "дня" : "дней"} назад
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex max-w-full flex-shrink-0 gap-2 overflow-x-auto pb-1 md:justify-end md:overflow-visible">
          {/* Archived Badge */}
          {place.archivedAt && (
            <span className="inline-flex h-10 shrink-0 items-center rounded-2xl bg-stone-100 px-3 text-xs font-medium text-stone-500">
              Архив
            </span>
          )}

          <button
            type="button"
            onClick={() => setStatisticsOpen(true)}
            className={cn(actionButtonClass, neutralActionClass)}
          >
            <BarChart3 className="h-4 w-4 shrink-0" />
            Статистика
          </button>

          {!place.archivedAt && displayStatus !== "PENDING" && (
            <Link
              href={`/business/places/${place.id}/edit`}
              className={cn(actionButtonClass, neutralActionClass)}
            >
              <Pencil className="h-4 w-4 shrink-0" />
              Редактировать
            </Link>
          )}

          {/* Places cannot be promoted - only events and offers */}

          {/* Unarchive Action */}
          {place.archivedAt && onUnarchive && (
            <Button
              variant="ghost"
              onClick={handleUnarchive}
              disabled={isArchiving}
              className={iconActionClass}
              title="Восстановить"
              aria-label="Восстановить"
            >
              <ArchiveRestore className="h-4 w-4" />
            </Button>
          )}

          {/* Archive Action (for active places) */}
          {!place.archivedAt && onArchive && place.status !== "DRAFT" && (
            <Button
                variant="ghost"
                onClick={() => setShowArchiveDialog(true)}
                className={iconActionClass}
                title="В архив"
                aria-label="В архив"
              >
              <Archive className="h-4 w-4" />
            </Button>
          )}

          {/* Delete Action (only for DRAFT) */}
          {place.status === "DRAFT" && onDelete && !place.archivedAt && (
            <Button
                variant="ghost"
                onClick={() => setShowDeleteDialog(true)}
                className="h-10 w-10 shrink-0 rounded-2xl p-0 text-stone-400 hover:bg-red-50 hover:text-red-600"
                title="Удалить"
                aria-label="Удалить"
              >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <PublicationStatisticsDialog
        open={statisticsOpen}
        onOpenChange={setStatisticsOpen}
        title={displayTitle}
        entityLabel="места"
        metrics={placeMetrics}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить место?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить &quot;{displayTitle}&quot;? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Переместить в архив?</AlertDialogTitle>
            <AlertDialogDescription>
              Место &quot;{displayTitle}&quot; будет скрыто от публичного доступа. Вы сможете восстановить его в любое время.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isArchiving}
            >
              {isArchiving ? "Архивация..." : "В архив"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
