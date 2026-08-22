"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  MAX_IMAGE_FILE_SIZE_MB,
  MAX_IMAGE_FILES,
  UPLOAD_IMAGE_ACCEPT,
  getFileTooLargeMessage,
  getUploadHintText,
} from "@/lib/uploads/uploadConfig";
import { useMediaLibraryPager, type MediaLibraryPage } from "@/components/media/useMediaLibraryPager";
import { useMediaLibraryScrollSentinel } from "@/components/media/useMediaLibraryScrollSentinel";
import { MEDIA_PICKER_PAGE_SIZE } from "@/lib/media/mediaPickerConstants";

export type MediaUploadMode = "single" | "multiple";

export type MediaUploadItem = {
  id: string;
  url: string;
  alt?: string | null;
  title?: string | null;
};

type MediaUploadValue = MediaUploadItem | MediaUploadItem[] | null;

export interface MediaUploadFieldProps {
  label?: string;
  description?: string;
  required?: boolean;
  mode: MediaUploadMode;
  value: MediaUploadValue;
  onChange: (value: MediaUploadValue) => void;
  maxFiles?: number;
  maxSizeMb?: number;
  accept?: string;
  disabled?: boolean;
  entityType?: string;
  context?: string;
  allowMediaLibrary?: boolean;
  allowUpload?: boolean;
  onUploadFiles?: (files: File[]) => Promise<MediaUploadItem[]>;
  loadMediaLibraryPage?: (args: { cursor: string | null; limit: number }) => Promise<MediaLibraryPage<MediaUploadItem>>;
  /** Page size for infinite scroll in the library dialog (default 24). */
  libraryPageSize?: number;
  /** Owner identity of the library (e.g. article authorUserId). Changing it resets items/selection and refetches. */
  libraryOwnerKey?: string | null;
  mediaLibraryTitle?: string;
  mediaLibraryDescription?: string;
  singleEmptyHint?: string;
  multipleEmptyHint?: string;
  uploadButtonLabel?: string;
  libraryButtonLabel?: string;
  replaceButtonLabel?: string;
  uploadSuccessMessage?: string;
  librarySelectSuccessMessage?: string;
  allowReorder?: boolean;
  className?: string;
}

function normalizeItems(mode: MediaUploadMode, value: MediaUploadValue): MediaUploadItem[] {
  if (mode === "single") {
    return value && !Array.isArray(value) ? [value] : [];
  }
  return Array.isArray(value) ? value : [];
}

function matchesAccept(file: File, accept: string): boolean {
  const rules = accept
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (rules.length === 0) return true;

  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();

  return rules.some((rule) => {
    if (rule.startsWith(".")) return fileName.endsWith(rule);
    if (rule.endsWith("/*")) {
      const prefix = rule.slice(0, -1);
      return fileType.startsWith(prefix);
    }
    return fileType === rule;
  });
}

function reorderItems(items: MediaUploadItem[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(index, 1);
  next.splice(nextIndex, 0, moved);
  return next;
}

export function MediaUploadField({
  label,
  description,
  required = false,
  mode,
  value,
  onChange,
  maxFiles,
  maxSizeMb,
  accept = UPLOAD_IMAGE_ACCEPT,
  disabled = false,
  entityType,
  context,
  allowMediaLibrary = true,
  allowUpload = true,
  onUploadFiles,
  loadMediaLibraryPage,
  libraryPageSize = MEDIA_PICKER_PAGE_SIZE,
  libraryOwnerKey = null,
  mediaLibraryTitle = "Выбрать из медиатеки",
  mediaLibraryDescription,
  singleEmptyHint = "Выберите главное изображение из медиатеки или загрузите файл",
  multipleEmptyHint = "Можно взять изображения из медиатеки или загрузить файлы",
  uploadButtonLabel = "Загрузить файл",
  libraryButtonLabel = "Выбрать из медиатеки",
  replaceButtonLabel = "Заменить",
  uploadSuccessMessage,
  librarySelectSuccessMessage,
  allowReorder = false,
  className,
}: MediaUploadFieldProps) {
  const items = useMemo(() => normalizeItems(mode, value), [mode, value]);
  const inputRef = useRef<HTMLInputElement>(null);

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySelection, setLibrarySelection] = useState<Set<string>>(() => new Set());
  const [uploading, setUploading] = useState(false);
  const libraryScrollRef = useRef<HTMLDivElement | null>(null);
  const librarySentinelRef = useRef<HTMLDivElement | null>(null);
  const libraryOpenRef = useRef(libraryOpen);

  const {
    items: libraryItems,
    loadingInitial: libraryLoading,
    loadingMore: libraryLoadingMore,
    hasMore: libraryHasMore,
    loadInitial: loadLibraryInitial,
    loadMore: loadLibraryMore,
  } = useMediaLibraryPager<MediaUploadItem>({
    pageSize: libraryPageSize,
    loadPage: loadMediaLibraryPage,
    ownerKey: libraryOwnerKey,
  });

  const effectiveMaxFiles = mode === "single" ? 1 : Math.max(1, maxFiles ?? MAX_IMAGE_FILES);
  const effectiveMaxSizeMb = maxSizeMb ?? MAX_IMAGE_FILE_SIZE_MB;
  const emptyHint = mode === "single" ? singleEmptyHint : multipleEmptyHint;
  const canUpload = allowUpload && !disabled && typeof onUploadFiles === "function";
  const canOpenLibrary = allowMediaLibrary && !disabled && typeof loadMediaLibraryPage === "function";

  const commitItems = (nextItems: MediaUploadItem[]) => {
    if (mode === "single") {
      onChange(nextItems[0] ?? null);
      return;
    }
    onChange(nextItems);
  };

  const validateFiles = (files: File[]) => {
    if (files.length === 0) return false;
    if (mode === "single" && files.length > 1) {
      toast.error("Для этого поля можно выбрать только одно изображение");
      return false;
    }
    if (mode === "multiple" && items.length + files.length > effectiveMaxFiles) {
      toast.error(`Можно добавить не больше ${effectiveMaxFiles} изображений`);
      return false;
    }
    for (const file of files) {
      if (!matchesAccept(file, accept)) {
        toast.error(`Файл «${file.name}» имеет неподдерживаемый формат`);
        return false;
      }
      if (file.size > effectiveMaxSizeMb * 1024 * 1024) {
        toast.error(
          effectiveMaxSizeMb === MAX_IMAGE_FILE_SIZE_MB
            ? getFileTooLargeMessage()
            : `Файл слишком большой. Максимальный размер — ${effectiveMaxSizeMb} МБ.`,
        );
        return false;
      }
    }
    return true;
  };

  const handleFiles = async (incoming: FileList | File[] | null) => {
    if (!canUpload || uploading) return;
    const files = Array.from(incoming ?? []);
    if (!validateFiles(files)) return;

    setUploading(true);
    try {
      const uploaded = await onUploadFiles(files);
      const normalized = uploaded.filter((item) => item?.id && item?.url);
      if (normalized.length === 0) {
        toast.error("Не удалось получить изображения после загрузки");
        return;
      }

      if (mode === "single") {
        commitItems([normalized[0]]);
        if (uploadSuccessMessage) toast.success(uploadSuccessMessage);
        return;
      }

      const existingIds = new Set(items.map((item) => item.id));
      const merged = [...items];
      for (const item of normalized) {
        if (existingIds.has(item.id)) continue;
        merged.push(item);
        existingIds.add(item.id);
      }
      commitItems(merged.slice(0, effectiveMaxFiles));
      if (uploadSuccessMessage) {
        toast.success(
          normalized.length === 1 ? uploadSuccessMessage : `${uploadSuccessMessage}: ${normalized.length}`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  };

  const openLibrary = async () => {
    if (!canOpenLibrary) return;
    setLibraryOpen(true);
    setLibrarySelection(new Set());
    try {
      await loadLibraryInitial();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить медиатеку");
    }
  };

  const handleLoadMore = useCallback(() => {
    void loadLibraryMore().catch((error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить медиатеку");
    });
  }, [loadLibraryMore]);

  const currentIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);

  const selectSingleLibraryItem = (item: MediaUploadItem) => {
    commitItems([item]);
    setLibraryOpen(false);
    if (librarySelectSuccessMessage) toast.success(librarySelectSuccessMessage);
  };

  const toggleMultipleLibrarySelection = (item: MediaUploadItem) => {
    if (currentIds.has(item.id)) return;
    setLibrarySelection((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        if (items.length + next.size >= effectiveMaxFiles) {
          toast.error(`Можно добавить не больше ${effectiveMaxFiles} изображений`);
          return prev;
        }
        next.add(item.id);
      }
      return next;
    });
  };

  const addSelectedLibraryItems = () => {
    const selected = libraryItems.filter((item) => librarySelection.has(item.id));
    if (selected.length === 0) {
      toast.message("Отметьте изображения галочками");
      return;
    }
    const existingIds = new Set(items.map((item) => item.id));
    const merged = [...items];
    for (const item of selected) {
      if (existingIds.has(item.id)) continue;
      merged.push(item);
      existingIds.add(item.id);
    }
    commitItems(merged.slice(0, effectiveMaxFiles));
    setLibraryOpen(false);
    if (librarySelectSuccessMessage) {
      toast.success(
        selected.length === 1 ? librarySelectSuccessMessage : `${librarySelectSuccessMessage}: ${selected.length}`,
      );
    }
  };

  const removeAt = (index: number) => {
    const nextItems = items.filter((_, itemIndex) => itemIndex !== index);
    commitItems(nextItems);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const next = reorderItems(items, index, direction);
    commitItems(next);
  };

  useEffect(() => {
    if (!libraryOpen) {
      setLibrarySelection(new Set());
    }
  }, [libraryOpen]);

  useEffect(() => {
    libraryOpenRef.current = libraryOpen;
  }, [libraryOpen]);

  useEffect(() => {
    setLibrarySelection(new Set());
    if (libraryOpenRef.current) {
      void loadLibraryInitial().catch((error) => {
        toast.error(error instanceof Error ? error.message : "Не удалось загрузить медиатеку");
      });
    }
    // Owner switch (e.g. article author changed) must never mix libraries — the
    // pager itself resets on libraryOwnerKey too; this only refetches if the
    // dialog is already open, so the visible grid doesn't stall on stale data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryOwnerKey]);

  useMediaLibraryScrollSentinel({
    active: libraryOpen,
    hasMore: libraryHasMore,
    onLoadMore: handleLoadMore,
    sentinelRef: librarySentinelRef,
    rootRef: libraryScrollRef,
  });

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      {canOpenLibrary ? (
        <Button type="button" variant="outline" disabled={disabled || libraryLoading || uploading} onClick={openLibrary}>
          {libraryButtonLabel}
        </Button>
      ) : null}
      {canUpload ? (
        <Button type="button" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {items.length > 0 && mode === "single" ? replaceButtonLabel : uploadButtonLabel}
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className={cn("space-y-4", className)} data-entity-type={entityType} data-context={context}>
      {(label || description) ? (
        <div className="space-y-1.5">
          {label ? (
            <Label className="text-base font-medium text-foreground">
              {label}
              {required ? <span className="ml-1 text-destructive">*</span> : null}
            </Label>
          ) : null}
          {description ? (
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={mode === "multiple"}
        className="sr-only"
        disabled={!canUpload || uploading}
        onChange={(event) => {
          // HTMLInputElement.files — это «живая» коллекция; если сначала захватить
          // event.target.files в переменную, а потом сбросить value="" (чтобы можно
          // было повторно выбрать тот же файл), та же FileList опустеет, и
          // handleFiles получит 0 файлов → ничего не загрузится. Поэтому копируем
          // в массив ДО сброса value.
          const files = event.target.files ? Array.from(event.target.files) : [];
          event.target.value = "";
          void handleFiles(files);
        }}
      />

      {items.length === 0 ? (
        <div
          className={cn(
            "rounded-2xl border border-dashed border-gray-300 bg-muted/20 px-6 py-10 text-center transition-colors sm:px-8",
            canUpload && "hover:border-primary/40 hover:bg-muted/30",
            disabled && "opacity-60",
          )}
          onDragOver={(event) => {
            if (!canUpload) return;
            event.preventDefault();
          }}
          onDrop={(event) => {
            if (!canUpload) return;
            event.preventDefault();
            void handleFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <div className="mx-auto flex max-w-md flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border/70">
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">{emptyHint}</p>
              <p className="text-xs text-muted-foreground">
                {mode === "multiple"
                  ? getUploadHintText(effectiveMaxFiles)
                  : effectiveMaxSizeMb === MAX_IMAGE_FILE_SIZE_MB
                    ? getUploadHintText(effectiveMaxFiles, false)
                    : `Поддерживаются JPEG, JPG, PNG, WebP, GIF, AVIF, HEIC, HEIF. До ${effectiveMaxSizeMb} МБ.`}
              </p>
            </div>
            {actionButtons}
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-background p-4 sm:p-5">
          {mode === "single" ? (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={items[0].url}
                alt={items[0].alt ?? items[0].title ?? ""}
                className="aspect-[16/10] w-full object-cover"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="group overflow-hidden rounded-2xl border border-gray-200 bg-muted"
                >
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.alt ?? item.title ?? ""}
                      className="aspect-square w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                      <div className="flex items-center gap-1">
                        {allowReorder && items.length > 1 ? (
                          <>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full bg-white/80 text-foreground hover:bg-white"
                              disabled={disabled || index === 0}
                              onClick={() => moveItem(index, -1)}
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full bg-white/80 text-foreground hover:bg-white"
                              disabled={disabled || index === items.length - 1}
                              onClick={() => moveItem(index, 1)}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full bg-white/80 text-destructive hover:bg-white"
                        disabled={disabled}
                        onClick={() => removeAt(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {mode === "single"
                ? "Главное изображение выбрано"
                : `${items.length} из ${effectiveMaxFiles} изображений`}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {mode === "single" ? (
                <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={disabled} onClick={() => commitItems([])}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Удалить
                </Button>
              ) : null}
              {actionButtons}
            </div>
          </div>
        </div>
      )}

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="px-6 pb-2 pt-6">
            <DialogTitle>{mediaLibraryTitle}</DialogTitle>
            <DialogDescription>
              {mediaLibraryDescription ??
                (mode === "single"
                  ? "Выберите одно изображение для этого поля."
                  : "Выберите несколько изображений и добавьте их в галерею.")}
            </DialogDescription>
          </DialogHeader>

          <div ref={libraryScrollRef} className="min-h-[220px] flex-1 overflow-y-auto px-6 pb-4">
            {libraryLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : libraryItems.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                В медиатеке пока нет изображений.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {libraryItems.map((item) => {
                  const alreadySelected = currentIds.has(item.id);
                  const isPending = librarySelection.has(item.id);
                  const disabledTile = disabled || alreadySelected;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={disabledTile}
                      className={cn(
                        "group relative overflow-hidden rounded-2xl border bg-muted text-left transition focus:outline-none focus:ring-2 focus:ring-primary",
                        disabledTile ? "cursor-not-allowed border-border opacity-45" : "border-gray-200 hover:border-primary/40",
                        isPending && "ring-2 ring-primary ring-offset-2",
                      )}
                      onClick={() => {
                        if (mode === "single") {
                          selectSingleLibraryItem(item);
                          return;
                        }
                        toggleMultipleLibrarySelection(item);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt={item.alt ?? item.title ?? ""}
                        className="aspect-square w-full object-cover transition group-hover:scale-[1.02]"
                      />
                      <div className="absolute inset-0 flex items-start justify-end p-2">
                        {alreadySelected ? (
                          <span className="rounded-full bg-black/65 px-2 py-1 text-[11px] font-medium text-white">
                            Уже выбрано
                          </span>
                        ) : isPending ? (
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                            <Check className="h-4 w-4" />
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {libraryHasMore ? (
              <div ref={librarySentinelRef} className="flex justify-center py-4">
                {libraryLoadingMore ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : null}
              </div>
            ) : null}
          </div>

          {mode === "multiple" ? (
            <DialogFooter className="border-t border-border px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setLibraryOpen(false)}>
                Закрыть
              </Button>
              <Button type="button" onClick={addSelectedLibraryItems} disabled={librarySelection.size === 0}>
                Добавить выбранные
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
