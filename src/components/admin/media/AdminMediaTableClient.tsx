"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistance } from "date-fns";
import { ru } from "date-fns/locale";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import type { MediaAssetKind, MediaAssetStatus, MediaEntityType } from "@prisma/client";
import { Checkbox } from "@/components/ui/checkbox";
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
import { MediaStatusBadge } from "@/components/admin/media/MediaStatusBadge";
import { MediaKindBadge } from "@/components/admin/media/MediaKindBadge";
import { MediaPreview } from "@/components/admin/media/MediaPreview";
import { formatBytes } from "@/lib/media/formatBytes";
import { resolveDisplayFilename } from "@/lib/media/resolveDisplayFilename";
import { resolveEffectiveMetadata } from "@/lib/media/generateMediaMetadata";
import { pluralRu } from "@/lib/i18n/pluralRu";
import { cn } from "@/lib/utils";

export type AdminMediaTableRow = {
  id: string;
  status: MediaAssetStatus;
  kind: MediaAssetKind;
  filename: string;
  originalName: string | null;
  extension: string;
  mimeType: string;
  storageKey: string;
  publicUrl: string | null;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: string | Date;
  title: string | null;
  alt: string | null;
  caption: string | null;
  uploadedBy: { id: string; email: string } | null;
  usages: {
    id: string;
    entityType: MediaEntityType;
    entityId: string;
    field: string | null;
  }[];
};

function filesWord(n: number): string {
  return pluralRu(n, "файл", "файла", "файлов");
}

function formatDeletedToast(deleted: number, skippedInUse: number): string {
  if (skippedInUse <= 0) {
    return `Удалено ${deleted} ${filesWord(deleted)}.`;
  }
  return `Удалено ${deleted} ${filesWord(deleted)}. ${skippedInUse} пропущены — они используются в контенте.`;
}

export function AdminMediaTableClient({ items }: { items: AdminMediaTableRow[] }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const pageIds = useMemo(() => items.map((m) => m.id), [items]);

  const selectedOnPage = useMemo(
    () => pageIds.filter((id) => selectedIds.includes(id)),
    [pageIds, selectedIds]
  );

  const allSelected = pageIds.length > 0 && selectedOnPage.length === pageIds.length;
  const someSelected = selectedOnPage.length > 0 && !allSelected;

  const selectionStats = useMemo(() => {
    const selectedRows = items.filter((m) => selectedIds.includes(m.id));
    const deletable = selectedRows.filter((m) => m.usages.length === 0);
    const used = selectedRows.filter((m) => m.usages.length > 0);
    return {
      deletableCount: deletable.length,
      usedCount: used.length,
      totalSelected: selectedRows.length,
    };
  }, [items, selectedIds]);

  const toggleSelectAllOnPage = () => {
    if (allSelected) {
      setSelectedIds((ids) => ids.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((ids) => [...new Set([...ids, ...pageIds])]);
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const clearSelection = () => setSelectedIds([]);

  const openDeleteConfirm = () => {
    if (selectionStats.deletableCount === 0) {
      toast.error("Нет файлов для удаления: все выбранные используются в контенте.");
      return;
    }
    setConfirmOpen(true);
  };

  const runBulkDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/admin/media/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        deleted?: number;
        skippedInUse?: number;
        error?: string;
      };

      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Не удалось удалить файлы");
        return;
      }

      const deleted = typeof data.deleted === "number" ? data.deleted : 0;
      const skippedInUse = typeof data.skippedInUse === "number" ? data.skippedInUse : 0;

      toast.success(formatDeletedToast(deleted, skippedInUse));
      clearSelection();
      setConfirmOpen(false);
      router.refresh();
    } catch {
      toast.error("Ошибка сети при удалении");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {selectedIds.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 bg-slate-50 border-b border-gray-200 text-sm text-gray-800"
            role="status"
          >
            <span className="font-medium tabular-nums">Выбрано: {selectedIds.length}</span>
            <span className="hidden sm:inline text-gray-400" aria-hidden>
              ·
            </span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-8"
              disabled={isDeleting || selectionStats.deletableCount === 0}
              onClick={openDeleteConfirm}
            >
              Удалить
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={isDeleting}
              onClick={clearSelection}
            >
              Снять выделение
            </Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-10 px-2 py-3 text-left align-middle">
                  {items.length > 0 ? (
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={() => toggleSelectAllOnPage()}
                      aria-label="Выбрать все на странице"
                      className="translate-y-0.5"
                    />
                  ) : null}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Превью</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Файл</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Тип</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Размер</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Использований</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Загружен</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Статус</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((media) => {
                const displayFilename = resolveDisplayFilename({
                  filename: media.filename,
                  extension: media.extension,
                  mimeType: media.mimeType,
                });

                const displayOriginalName = resolveDisplayFilename({
                  filename: media.originalName ?? "",
                  extension: media.extension,
                  mimeType: media.mimeType,
                });

                const usageContext =
                  media.usages.length > 0
                    ? {
                        entityType: media.usages[0].entityType,
                        entityTitle: undefined,
                      }
                    : undefined;

                const effectiveMetadata = resolveEffectiveMetadata(
                  {
                    title: media.title,
                    alt: media.alt,
                    caption: media.caption,
                    filename: displayFilename,
                  },
                  usageContext
                );

                const displayTitle = effectiveMetadata.title || displayFilename;
                const isRowSelected = selectedIds.includes(media.id);

                return (
                  <tr
                    key={media.id}
                    className={cn(
                      "hover:bg-gray-50",
                      media.status === "ARCHIVED" ? "opacity-60" : "",
                      isRowSelected ? "bg-blue-50/70 hover:bg-blue-50/90" : ""
                    )}
                  >
                    <td className="w-10 px-2 py-3 align-middle">
                      <Checkbox
                        checked={isRowSelected}
                        onCheckedChange={() => toggleRow(media.id)}
                        aria-label={`Выбрать ${displayTitle}`}
                        className="translate-y-0.5"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <MediaPreview
                        kind={media.kind}
                        publicUrl={media.publicUrl}
                        filename={media.filename}
                        size="sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2 min-w-0">
                          <Link
                            href={`/admin/media/${media.id}`}
                            className="font-medium text-gray-900 hover:text-blue-600 transition-colors truncate"
                          >
                            {displayTitle}
                          </Link>
                          {media.status === "ARCHIVED" && (
                            <span className="inline-flex shrink-0 items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              Архивный
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{displayOriginalName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <MediaKindBadge
                        kind={media.kind}
                        extension={media.extension}
                        mimeType={media.mimeType}
                        originalName={media.originalName}
                        storageKey={media.storageKey}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{formatBytes(media.sizeBytes)}</p>
                      {media.width && media.height && (
                        <p className="text-xs text-gray-500">
                          {media.width}×{media.height}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                          media.usages.length > 0
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {media.usages.length}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {media.uploadedBy && (
                          <p className="text-xs text-gray-600">{media.uploadedBy.email}</p>
                        )}
                        <p className="text-xs text-gray-500">
                          {formatDistance(new Date(media.createdAt), new Date(), {
                            addSuffix: true,
                            locale: ru,
                          })}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <MediaStatusBadge status={media.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/media/${media.id}`}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Детали
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {items.length === 0 && (
          <div className="text-center py-12">
            <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Медиафайлы не найдены</p>
          </div>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectionStats.usedCount === 0
                ? `Удалить ${selectionStats.deletableCount} ${filesWord(selectionStats.deletableCount)}?`
                : "Удалить доступные файлы?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {selectionStats.usedCount === 0 ? (
                  <p>Это действие нельзя отменить.</p>
                ) : (
                  <p>
                    {selectionStats.deletableCount} {filesWord(selectionStats.deletableCount)} будут
                    удалены. {selectionStats.usedCount} {filesWord(selectionStats.usedCount)}{" "}
                    используются в контенте и будут пропущены.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={isDeleting}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                void runBulkDelete();
              }}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin inline" aria-hidden />
                  Удаление…
                </>
              ) : (
                "Удалить"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
