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
import { Trash2, MapPin, Navigation, Archive, ArchiveRestore } from "lucide-react";
import { formatDistance } from "@/lib/formatDistance";
import { toast } from "sonner";

interface PlaceCardData {
  id: string;
  title: string;
  shortAddress?: string | null;
  displayTitle?: string; // Optional pre-computed display title
  status: ContentStatus;
  formattedAddr: string | null;
  customAddress: string | null;
  moderatorComment: string | null;
  revisionRequestedAt: Date | null;
  archivedAt?: Date | null;
  city: {
    hasMetro: boolean;
    metroMaxDistanceM: number | null;
  } | null;
  districtAuto: {
    name: string;
  } | null;
  districtManual: {
    name: string;
  } | null;
  metroAuto: {
    name: string;
  } | null;
  metroAutoDistanceM: number | null;
  metroManual: {
    name: string;
  } | null;
  metroManualDistanceM: number | null;
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
}

interface PlaceCardHorizontalProps {
  place: PlaceCardData;
  onDelete?: (placeId: string) => void;
  onArchive?: (placeId: string) => void;
  onUnarchive?: (placeId: string) => void;
}

const STATUS_CONFIG = {
  DRAFT: {
    label: "Черновик",
    variant: "secondary" as const,
    className: "",
    action: "Продолжить",
  },
  PENDING: {
    label: "На модерации",
    variant: "outline" as const,
    className: "bg-gray-100 text-gray-700 border-gray-200",
    action: "На модерации",
  },
  PUBLISHED: {
    label: "Опубликовано",
    variant: "default" as const,
    className: "",
    action: "Редактировать",
  },
  NEEDS_REVISION: {
    label: "Требует правок",
    variant: "destructive" as const,
    className: "",
    action: "Исправить",
  },
  REJECTED: {
    label: "Отклонено",
    variant: "destructive" as const,
    className: "",
    action: "Исправить",
  },
};

const REVISION_STATUS_CONFIG = {
  DRAFT: {
    label: "Редактирование изменений",
    variant: "secondary" as const,
  },
  PENDING: {
    label: "Изменения на проверке",
    variant: "default" as const,
  },
  NEEDS_REVISION: {
    label: "Требуются правки",
    variant: "destructive" as const,
  },
};

export function PlaceCardHorizontal({ place, onDelete, onArchive, onUnarchive }: PlaceCardHorizontalProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const statusConfig = STATUS_CONFIG[place.status] || STATUS_CONFIG.DRAFT;
  
  // Determine effective status (revision takes precedence for display)
  const hasActiveRevision = place.activeRevision && 
    ["DRAFT", "PENDING", "NEEDS_REVISION"].includes(place.activeRevision.status);
  
  const displayStatus = hasActiveRevision && place.status === "PUBLISHED"
    ? place.activeRevision!.status
    : place.status;
  
  // Get display values
  const displayTitle = place.displayTitle || place.title || "Без названия";
  const displayAddress = place.formattedAddr || place.customAddress || "Локация не задана";
  
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
  
  // District
  const districtName = place.districtManual?.name ?? place.districtAuto?.name;
  
  // Metro (with distance and threshold check)
  const metroName = place.metroManual?.name ?? place.metroAuto?.name;
  const metroDistance = place.metroManualDistanceM ?? place.metroAutoDistanceM;
  const cityHasMetro = place.city?.hasMetro ?? false;
  const metroMaxDistance = place.city?.metroMaxDistanceM ?? 2500;
  
  const shouldShowMetro = 
    metroName && 
    metroDistance !== null && 
    cityHasMetro && 
    metroDistance <= metroMaxDistance;
  
  // Cover image (logo or first gallery image)
  const coverImage = place.images.find(img => img.kind === "LOGO") || place.images[0];
  
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

  return (
    <>
      <div className="group flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all">
        {/* Cover Image */}
        <Link href={`/business/places/${place.id}/edit`} className="flex-shrink-0">
          <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100">
            {coverImage ? (
              <Image
                src={coverImage.url}
                alt={displayTitle}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <MapPin className="w-8 h-8" />
              </div>
            )}
          </div>
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Link href={`/business/places/${place.id}/edit`}>
            <h3 className="text-lg font-semibold text-gray-900 truncate hover:text-blue-600 transition-colors">
              {displayTitle}
            </h3>
          </Link>
          
          <p className="text-sm text-gray-600 truncate mt-1">
            {displayAddress}
          </p>
          
          {/* Status badge - always show for non-archived places */}
          {!place.archivedAt && (
            <div className="mt-2">
              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                place.status === "DRAFT"
                  ? "bg-gray-100 text-gray-700"
                  : place.status === "PENDING"
                  ? "bg-gray-100 text-gray-700 border border-gray-200"
                  : place.status === "PUBLISHED"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : place.status === "NEEDS_REVISION"
                  ? "bg-orange-50 text-orange-700 border border-orange-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {statusConfig.label}
              </span>
            </div>
          )}
          
          {/* Revision status badge for published places with active revisions */}
          {hasActiveRevision && place.status === "PUBLISHED" && place.activeRevision && (
            <div className="mt-2">
              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                place.activeRevision.status === "DRAFT" 
                  ? "bg-blue-50 text-blue-700"
                  : place.activeRevision.status === "PENDING"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-yellow-50 text-yellow-700"
              }`}>
                {REVISION_STATUS_CONFIG[place.activeRevision.status as keyof typeof REVISION_STATUS_CONFIG]?.label || place.activeRevision.status}
              </span>
            </div>
          )}
          
          {/* Inactivity warning for NEEDS_REVISION */}
          {daysSinceRevision !== null && (
            <p className="text-xs text-amber-600 mt-1">
              Отправлено на доработку {daysSinceRevision} {daysSinceRevision === 1 ? "день" : daysSinceRevision < 5 ? "дня" : "дней"} назад
            </p>
          )}
          
          {/* Geo Chips */}
          {(districtName || shouldShowMetro) && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {districtName && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded">
                  <MapPin className="w-3 h-3" />
                  {districtName}
                </span>
              )}
              
              {shouldShowMetro && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded">
                  <Navigation className="w-3 h-3" />
                  {metroName} • {formatDistance(metroDistance)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Archived Badge */}
          {place.archivedAt && (
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
              Архив
            </span>
          )}

          {/* Primary Action Button (acts as status indicator) */}
          {!place.archivedAt && (
            <Button
              asChild={displayStatus !== "PENDING"}
              disabled={displayStatus === "PENDING"}
              size="sm"
            >
              {displayStatus === "PENDING" ? (
                <span>{hasActiveRevision ? "На проверке" : statusConfig.action}</span>
              ) : (
                <Link href={`/business/places/${place.id}/edit`}>
                  {statusConfig.action}
                </Link>
              )}
            </Button>
          )}

          {/* Unarchive Action */}
          {place.archivedAt && onUnarchive && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnarchive}
              disabled={isArchiving}
            >
              <ArchiveRestore className="w-4 h-4 mr-2" />
              {isArchiving ? "Восстановление..." : "Восстановить"}
            </Button>
          )}

          {/* Archive Action (for active places) */}
          {!place.archivedAt && onArchive && place.status !== "DRAFT" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowArchiveDialog(true)}
              className="text-gray-400 hover:text-gray-600"
            >
              <Archive className="w-4 h-4" />
            </Button>
          )}

          {/* Delete Action (only for DRAFT) */}
          {place.status === "DRAFT" && onDelete && !place.archivedAt && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="text-gray-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить место?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить "{displayTitle}"? Это действие нельзя отменить.
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
              Место "{displayTitle}" будет скрыто от публичного доступа. Вы сможете восстановить его в любое время.
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
