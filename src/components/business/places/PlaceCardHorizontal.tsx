"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ContentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
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
import { Trash2, MapPin, Navigation } from "lucide-react";
import { formatDistance } from "@/lib/formatDistance";
import { toast } from "sonner";

interface PlaceCardData {
  id: string;
  title: string;
  status: ContentStatus;
  formattedAddr: string | null;
  customAddress: string | null;
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
}

interface PlaceCardHorizontalProps {
  place: PlaceCardData;
  onDelete?: (placeId: string) => void;
}

const STATUS_CONFIG = {
  DRAFT: {
    label: "Черновик",
    variant: "secondary" as const,
    action: "Продолжить",
  },
  PENDING: {
    label: "На модерации",
    variant: "default" as const,
    action: "На модерации",
  },
  PUBLISHED: {
    label: "Опубликовано",
    variant: "default" as const,
    action: "Редактировать",
  },
  NEEDS_CHANGES: {
    label: "Требует правок",
    variant: "destructive" as const,
    action: "Исправить",
  },
  REJECTED: {
    label: "Отклонено",
    variant: "destructive" as const,
    action: "Исправить",
  },
};

export function PlaceCardHorizontal({ place, onDelete }: PlaceCardHorizontalProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const statusConfig = STATUS_CONFIG[place.status] || STATUS_CONFIG.DRAFT;
  
  // Get display values
  const displayTitle = place.title || "Без названия";
  const displayAddress = place.formattedAddr || place.customAddress || "Локация не задана";
  
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
          {/* Status Badge */}
          <Badge variant={statusConfig.variant}>
            {statusConfig.label}
          </Badge>

          {/* Primary Action */}
          <Button
            asChild={place.status !== "PENDING"}
            disabled={place.status === "PENDING"}
            size="sm"
          >
            {place.status === "PENDING" ? (
              <span>{statusConfig.action}</span>
            ) : (
              <Link href={`/business/places/${place.id}/edit`}>
                {statusConfig.action}
              </Link>
            )}
          </Button>

          {/* Delete Action (only for DRAFT) */}
          {place.status === "DRAFT" && onDelete && (
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
    </>
  );
}
