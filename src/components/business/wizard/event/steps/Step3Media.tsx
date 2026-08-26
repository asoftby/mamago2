"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Check,
  GripVertical,
  ImagePlus,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";
import { toast } from "@/lib/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { EventFormData } from "../types";
import { MediaDropzone, type MediaDropzoneHandle } from "./MediaDropzone";
import { useMediaLibraryPager, type MediaLibraryPage } from "@/components/media/useMediaLibraryPager";
import { useMediaLibraryScrollSentinel } from "@/components/media/useMediaLibraryScrollSentinel";
import { MEDIA_PICKER_PAGE_SIZE } from "@/lib/media/mediaPickerConstants";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  MAX_IMAGE_FILE_SIZE_MB,
  getFileTooLargeMessage,
  validateUploadMimeType,
} from "@/lib/uploads/uploadConfig";

interface Step3MediaProps {
  data: EventFormData;
  onChange: (updates: Partial<EventFormData>) => void;
  isEditable: boolean;
  wizardSessionId?: string;
  eventId?: string;
}

interface GalleryItem {
  id: string;
  url: string;
  status: "uploading" | "done" | "error";
}

type PickerItem = {
  id: string;
  publicUrl: string | null;
  thumbnailUrl?: string | null;
  alt: string | null;
  title: string | null;
  fromEntity?: boolean;
  showImportBadge?: boolean;
  isUsed?: boolean;
};

type NormalizedMediaImage = {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
  alt?: string | null;
};

type ImportedMedia = {
  coverUrl: string | null;
  galleryUrls: string[];
};

type MediaStatus = "loading" | "loaded" | "empty";

/**
 * Get preview URL from media asset
 * Handles various URL formats and ensures proper path
 */
function getMediaAssetPreviewUrl(asset: {
  publicUrl?: string | null;
  url?: string | null;
  fileUrl?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  path?: string | null;
  id?: string;
}): string {
  const url =
    asset.thumbnailUrl ||
    asset.publicUrl ||
    asset.url ||
    asset.fileUrl ||
    asset.imageUrl ||
    asset.path ||
    "";

  if (!url) {
    // `/api/media/:id` is served by the file proxy and supports MediaAsset id lookup.
    if (asset.id) {
      return `/api/media/${encodeURIComponent(asset.id)}`;
    }
    return "";
  }

  // If it's a relative path without leading slash, add it
  if (!url.startsWith("/") && !url.startsWith("http://") && !url.startsWith("https://")) {
    return `/${url}`;
  }

  return url;
}

function normalizeMediaImage(asset: PickerItem): NormalizedMediaImage | null {
  const url = getMediaAssetPreviewUrl(asset);
  if (!url) return null;
  return {
    id: asset.id,
    url,
    thumbnailUrl: asset.thumbnailUrl ?? null,
    alt: asset.alt,
  };
}

function ImportBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800",
        className,
      )}
    >
      Из импорта
    </span>
  );
}

function MediaSourceBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700">
      {label}
    </span>
  );
}

function SortableGalleryItem({
  image,
  index,
  onRemove,
  disabled,
}: {
  image: GalleryItem;
  index: number;
  onRemove: (id: string) => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
    disabled: disabled || image.status !== "done",
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 group">
      <GalleryItemContent
        image={image}
        index={index}
        onRemove={onRemove}
        showDragHandle
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function StaticGalleryItem({
  image,
  index,
  onRemove,
}: {
  image: GalleryItem;
  index: number;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 group">
      <GalleryItemContent image={image} index={index} onRemove={onRemove} showDragHandle={false} />
    </div>
  );
}

function GalleryItemContent({
  image,
  index,
  onRemove,
  showDragHandle,
  dragHandleProps,
}: {
  image: GalleryItem;
  index: number;
  onRemove: (id: string) => void;
  showDragHandle: boolean;
  dragHandleProps?: Record<string, unknown>;
}) {
  if (image.status === "uploading") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (image.status === "error") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-red-50">
        <p className="text-xs text-red-600">Ошибка</p>
      </div>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.url} alt={`Gallery ${index + 1}`} className="h-full w-full object-cover" />

      <button
        onClick={() => onRemove(image.id)}
        className="absolute right-2 top-2 z-10 rounded-full bg-red-600 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-700 group-hover:opacity-100"
        type="button"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {showDragHandle ? (
        <div
          {...dragHandleProps}
          className="absolute left-2 top-2 z-10 cursor-move rounded bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      ) : null}

      <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
        Фото {index + 1}
      </div>
    </>
  );
}

export function Step3Media({
  data,
  onChange,
  isEditable,
  eventId,
}: Step3MediaProps) {
  const [coverPreview, setCoverPreview] = useState<string | null>(() =>
    data.coverImage ? getMediaAssetPreviewUrl({ id: data.coverImage }) : null,
  );
  const [coverPreviewUnavailable, setCoverPreviewUnavailable] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [isDraggingGallery, setIsDraggingGallery] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [importedMedia, setImportedMedia] = useState<ImportedMedia>({ coverUrl: null, galleryUrls: [] });
  const [mediaStatus, setMediaStatus] = useState<MediaStatus>("empty");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"cover" | "gallery">("cover");
  const [pickerSelection, setPickerSelection] = useState<Set<string>>(() => new Set());
  const [entityPickerItems, setEntityPickerItems] = useState<PickerItem[]>([]);
  const [entityPickerLoading, setEntityPickerLoading] = useState(false);
  const pickerScrollRef = useRef<HTMLDivElement | null>(null);
  const pickerSentinelRef = useRef<HTMLDivElement | null>(null);
  const [isApplyingImportedCover, setIsApplyingImportedCover] = useState(false);
  const [applyingImportedGalleryUrls, setApplyingImportedGalleryUrls] = useState<string[]>([]);
  const [selectedImportedUrl, setSelectedImportedUrl] = useState<string | null>(null);
  const [chosenImportedCoverUrl, setChosenImportedCoverUrl] = useState<string | null>(null);
  const [chosenImportedGalleryUrls, setChosenImportedGalleryUrls] = useState<string[]>([]);
  const [importedAssetSourceById, setImportedAssetSourceById] = useState<Record<string, string>>({});
  const [importedMediaIdBySourceUrl, setImportedMediaIdBySourceUrl] = useState<Record<string, string>>({});
  const [trailerHint, setTrailerHint] = useState<string | null>(null);

  const hasInitialized = useRef(false);
  const coverDropzoneRef = useRef<MediaDropzoneHandle | null>(null);
  const UPLOAD_TIMEOUT_MS = 120_000;

  function withUploadTimeout<T>(p: Promise<T>, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`${label}: превышено время ожидания`)), UPLOAD_TIMEOUT_MS);
      p.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          clearTimeout(t);
          reject(e);
        },
      );
    });
  }

  const { uploadImage } = useImageUpload({
    maxSizeMB: MAX_IMAGE_FILE_SIZE_MB,
    maxWidthOrHeight: 1920,
    quality: 0.9,
  });

  useEffect(() => {
    if (!hasInitialized.current && data.gallery.length > 0) {
      const items = data.gallery.map((id) => ({
        id,
        url: getMediaAssetPreviewUrl({ id }),
        status: "done" as const,
      }));
      setGalleryItems(items);
      hasInitialized.current = true;
    }
  }, [data.gallery]);

  useEffect(() => {
    if (data.coverImage) {
      const previewUrl = getMediaAssetPreviewUrl({ id: data.coverImage });
      setCoverPreview((current) => {
        if (current !== previewUrl) {
          return previewUrl;
        }
        return current;
      });
    } else if (!data.coverImage && coverPreview) {
      setCoverPreview(null);
    }
  }, [data.coverImage, coverPreview]);

  useEffect(() => {
    setCoverPreviewUnavailable(false);
  }, [coverPreview, data.coverImage]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!eventId) {
      setImportedMedia({ coverUrl: null, galleryUrls: [] });
      setMediaStatus("empty");
      return;
    }
    let cancelled = false;
    setMediaStatus("loading");
    (async () => {
      try {
        const res = await fetch(`/api/business/events/${eventId}/media-library`, { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setMediaStatus("empty");
          return;
        }
        const payload = (await res.json()) as { importedMedia?: ImportedMedia };
        if (cancelled) return;
        const next = {
          coverUrl: payload.importedMedia?.coverUrl ?? null,
          galleryUrls: payload.importedMedia?.galleryUrls ?? [],
        };
        setImportedMedia(next);
        const hasAny = Boolean(next.coverUrl) || next.galleryUrls.length > 0;
        setMediaStatus(hasAny ? "loaded" : "empty");
      } catch {
        if (!cancelled) setMediaStatus("empty");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Load trailer hint from import source
  useEffect(() => {
    if (!eventId) { setTrailerHint(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/business/events/${eventId}/trailer-source`, { credentials: "include" });
        if (!res.ok || cancelled) return;
        const payload = (await res.json()) as { trailer?: { trailerUrl?: string } | null };
        if (!cancelled) setTrailerHint(payload.trailer?.trailerUrl ?? null);
      } catch {
        // silent — trailer hint is optional
      }
    })();
    return () => { cancelled = true; };
  }, [eventId]);

  const sourceImageUrls = useMemo(
    () => [...new Set([importedMedia.coverUrl, ...importedMedia.galleryUrls].filter(Boolean))] as string[],
    [importedMedia.coverUrl, importedMedia.galleryUrls],
  );
  const hasImportedSourceImages = sourceImageUrls.length > 0;
  const importedCoverCandidateUrl = importedMedia.coverUrl ?? sourceImageUrls[0] ?? null;
  const importedGalleryCandidates = sourceImageUrls.filter((url) => url !== importedCoverCandidateUrl);

  useEffect(() => {
    if (!hasImportedSourceImages) {
      setSelectedImportedUrl(null);
      return;
    }
    setSelectedImportedUrl((prev) => (prev && sourceImageUrls.includes(prev) ? prev : sourceImageUrls[0] ?? null));
  }, [hasImportedSourceImages, sourceImageUrls]);

  const importRemoteImage = useCallback(async (url: string) => {
    const cachedMediaId = importedMediaIdBySourceUrl[url];
    if (cachedMediaId) {
      return {
        mediaId: cachedMediaId,
        publicUrl: `/api/media/${cachedMediaId}`,
        sourceUrl: url,
      };
    }

    const response = await fetch("/api/media/from-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ url }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      mediaId?: string;
      publicUrl?: string | null;
    };

    if (!response.ok || !payload.mediaId) {
      throw new Error(payload.error || "Не удалось импортировать изображение");
    }

    return {
      mediaId: payload.mediaId,
      publicUrl: payload.publicUrl ?? url,
      sourceUrl: url,
    };
  }, [importedMediaIdBySourceUrl]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setGalleryItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        onChange({ gallery: reordered.map((item) => item.id) });
        return reordered;
      });
    }
  };

  const loadGeneralMediaPage = useCallback(
    async ({ cursor, limit }: { cursor: string | null; limit: number }): Promise<MediaLibraryPage<PickerItem>> => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/business/media-picker?${params.toString()}`, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Не удалось загрузить медиатеку");
      }
      const data = (await response.json()) as { items?: PickerItem[]; nextCursor: string | null; hasMore: boolean };
      return {
        items: (data.items ?? []).filter((item) => item.publicUrl),
        nextCursor: data.nextCursor ?? null,
        hasMore: Boolean(data.hasMore),
      };
    },
    [],
  );

  const generalPager = useMediaLibraryPager<PickerItem>({
    pageSize: MEDIA_PICKER_PAGE_SIZE,
    loadPage: loadGeneralMediaPage,
  });

  // Media already linked to this event (usages, cover, gallery) — a small
  // bounded set, so it's loaded once (not paginated) and pinned first.
  const loadEntityMedia = useCallback(async () => {
    if (!eventId) {
      setEntityPickerItems([]);
      return;
    }
    setEntityPickerLoading(true);
    try {
      const response = await fetch(`/api/business/events/${eventId}/media-library`, { credentials: "include" });
      if (response.ok) {
        const data = (await response.json()) as { items: PickerItem[] };
        setEntityPickerItems((data.items ?? []).filter((item) => item.publicUrl));
      } else {
        setEntityPickerItems([]);
      }
    } catch {
      setEntityPickerItems([]);
    } finally {
      setEntityPickerLoading(false);
    }
  }, [eventId]);

  const pickerItems = useMemo(() => {
    const seen = new Set(entityPickerItems.map((item) => item.id));
    const generalOnly = generalPager.items.filter((item) => !seen.has(item.id));
    return [...entityPickerItems, ...generalOnly];
  }, [entityPickerItems, generalPager.items]);

  const pickerLoading = entityPickerLoading || generalPager.loadingInitial;

  const loadGeneralMediaMore = generalPager.loadMore;
  const handlePickerLoadMore = useCallback(() => {
    void loadGeneralMediaMore().catch((error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить медиатеку");
    });
  }, [loadGeneralMediaMore]);

  useMediaLibraryScrollSentinel({
    active: pickerOpen,
    hasMore: generalPager.hasMore,
    onLoadMore: handlePickerLoadMore,
    sentinelRef: pickerSentinelRef,
    rootRef: pickerScrollRef,
  });

  const openPicker = (mode: "cover" | "gallery") => {
    setPickerMode(mode);
    setPickerSelection(new Set());
    setPickerOpen(true);
    void loadEntityMedia();
    void generalPager.loadInitial().catch((error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить медиатеку");
    });
  };

  const togglePickerSelection = (item: PickerItem) => {
    if (!normalizeMediaImage(item)) return;
    if (pickerMode === "cover") {
      setPickerSelection(new Set([item.id]));
      return;
    }

    setPickerSelection((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const applyPickerSelection = () => {
    const selectedItems = pickerItems
      .filter((item) => pickerSelection.has(item.id))
      .map((item) => ({ raw: item, normalized: normalizeMediaImage(item) }))
      .filter((item): item is { raw: PickerItem; normalized: NormalizedMediaImage } => item.normalized !== null);
    if (selectedItems.length === 0) {
      toast.message("Выберите изображение");
      return;
    }

    if (pickerMode === "cover") {
      const first = selectedItems[0];
      onChange({ coverImage: first.raw.id });
      setCoverPreview(first.normalized.url);
      setCoverPreviewUnavailable(false);
      setPickerOpen(false);
      toast.success("Главное изображение выбрано");
      return;
    }

    setGalleryItems((prev) => {
      const merged = [
        ...prev,
        ...selectedItems
          .filter((item) => !prev.some((row) => row.id === item.raw.id))
          .map((item) => ({
            id: item.raw.id,
            url: item.normalized.url,
            status: "done" as const,
          })),
      ];
      onChange({ gallery: merged.map((item) => item.id) });
      return merged;
    });
    setPickerOpen(false);
    toast.success(
      selectedItems.length === 1 ? "Изображение добавлено" : `Добавлено изображений: ${selectedItems.length}`,
    );
  };

  const applyImportedCover = async (url: string) => {
    setIsApplyingImportedCover(true);
    try {
      const cover = await importRemoteImage(url);
      setCoverPreview(cover.publicUrl);
      setCoverPreviewUnavailable(false);
      setImportedAssetSourceById((prev) => ({ ...prev, [cover.mediaId]: cover.sourceUrl }));
      setImportedMediaIdBySourceUrl((prev) => ({ ...prev, [cover.sourceUrl]: cover.mediaId }));
      setChosenImportedCoverUrl(url);
      setSelectedImportedUrl(url);
      onChange({ coverImage: cover.mediaId });
      toast.success("Изображение из источника установлено как обложка");
    } catch (error) {
      console.error("Apply imported cover error:", error);
      toast.error(error instanceof Error ? error.message : "Не удалось использовать изображение из источника");
    } finally {
      setIsApplyingImportedCover(false);
    }
  };

  const applyImportedGallery = async (urls: string[]) => {
    if (urls.length === 0) return;
    setApplyingImportedGalleryUrls((prev) => [...new Set([...prev, ...urls])]);
    try {
      const imported = await Promise.all(urls.map((url) => importRemoteImage(url)));
      const toAdd = imported.filter((item) => !data.gallery.includes(item.mediaId));

      if (toAdd.length === 0) {
        toast.message("Эти изображения уже добавлены");
        return;
      }

      setGalleryItems((prev) => {
        const merged = [
          ...prev,
          ...toAdd
            .filter((item) => !prev.some((row) => row.id === item.mediaId))
            .map((item) => ({
              id: item.mediaId,
              url: item.publicUrl,
              status: "done" as const,
            })),
        ];
        onChange({ gallery: merged.map((item) => item.id) });
        return merged;
      });
      setImportedAssetSourceById((prev) => {
        const next = { ...prev };
        for (const item of imported) {
          if (toAdd.some((entry) => entry.mediaId === item.mediaId)) {
            next[item.mediaId] = item.sourceUrl;
          }
        }
        return next;
      });
      setImportedMediaIdBySourceUrl((prev) => {
        const next = { ...prev };
        for (const item of imported) {
          next[item.sourceUrl] = item.mediaId;
        }
        return next;
      });
      setChosenImportedGalleryUrls((prev) => [...new Set([...prev, ...urls])]);
      if (urls.length === 1) setSelectedImportedUrl(urls[0] ?? null);
      toast.success(
        toAdd.length === 1 ? "Изображение из источника добавлено" : `Добавлено изображений: ${toAdd.length}`,
      );
    } catch (error) {
      console.error("Apply imported gallery error:", error);
      toast.error(error instanceof Error ? error.message : "Не удалось добавить изображения из источника");
    } finally {
      setApplyingImportedGalleryUrls((prev) => prev.filter((url) => !urls.includes(url)));
    }
  };

  const handleCoverFilesSelect = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!validateUploadMimeType(file)) {
      toast.error("Пожалуйста, выберите изображение");
      return;
    }
    if (file.size > MAX_IMAGE_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(getFileTooLargeMessage());
      return;
    }

    setIsUploadingCover(true);
    try {
      const uploadedImage = await withUploadTimeout(uploadImage(file), "Обложка");
      if (!uploadedImage) throw new Error("Failed to upload image");

      setCoverPreview(uploadedImage.url);
      setCoverPreviewUnavailable(false);
      onChange({ coverImage: uploadedImage.mediaId ?? uploadedImage.id });
      toast.success("Обложка загружена");
    } catch (error) {
      console.error("Cover upload error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка загрузки обложки");
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleGalleryFilesSelect = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((file) => {
      if (!validateUploadMimeType(file)) {
        toast.error(`${file.name} не является изображением`);
        return false;
      }
      if (file.size > MAX_IMAGE_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(getFileTooLargeMessage());
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const placeholders: GalleryItem[] = validFiles.map((file) => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      url: URL.createObjectURL(file),
      status: "uploading" as const,
    }));
    setGalleryItems((prev) => [...prev, ...placeholders]);

    let nextGallery = [...data.gallery];
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const placeholderId = placeholders[i].id;
      try {
        const uploadedImage = await withUploadTimeout(uploadImage(file), file.name);
        if (!uploadedImage) throw new Error("Failed to upload image");

        const mediaId = uploadedImage.mediaId ?? uploadedImage.id;
        setGalleryItems((prev) =>
          prev.map((img) =>
            img.id === placeholderId ? { id: mediaId, url: uploadedImage.url, status: "done" as const } : img,
          ),
        );
        onChange({ gallery: [...nextGallery, mediaId] });
        nextGallery = [...nextGallery, mediaId];
      } catch (error) {
        console.error("Gallery upload error:", error);
        setGalleryItems((prev) =>
          prev.map((img) => (img.id === placeholderId ? { ...img, status: "error" as const } : img)),
        );
        toast.error(`Ошибка загрузки ${file.name}`);
      }
    }
  };

  const handleCoverRemove = () => {
    if (!isEditable) return;
    if (data.coverImage || coverPreview) {
      if (data.coverImage && importedAssetSourceById[data.coverImage]) {
        const sourceUrl = importedAssetSourceById[data.coverImage];
        setChosenImportedCoverUrl((prev) => (prev === sourceUrl ? null : prev));
        setImportedAssetSourceById((prev) => {
          const next = { ...prev };
          delete next[data.coverImage!];
          return next;
        });
      }
      setCoverPreview(null);
      setCoverPreviewUnavailable(false);
      onChange({ coverImage: null });
      return;
    }
  };

  const handleGalleryRemove = (imageId: string) => {
    if (!isEditable) return;
    const sourceUrl = importedAssetSourceById[imageId];
    if (sourceUrl) {
      setChosenImportedGalleryUrls((prev) => prev.filter((url) => url !== sourceUrl));
      setImportedAssetSourceById((prev) => {
        const next = { ...prev };
        delete next[imageId];
        return next;
      });
    }
    setGalleryItems((prev) => prev.filter((img) => img.id !== imageId));
    onChange({ gallery: data.gallery.filter((id) => id !== imageId) });
  };

  const hasRenderedGallery = galleryItems.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-xl font-semibold">Медиа</h2>
        <p className="text-[12px] text-muted-foreground">
          Сначала выберите подходящее изображение из источника, затем при необходимости замените его.
        </p>
      </div>

      {eventId ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-sky-950">Изображение из источника</h3>
            {mediaStatus === "loaded" ? <ImportBadge /> : null}
          </div>
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            {mediaStatus === "loading" ? (
              <>
                <div className="overflow-hidden rounded-xl border border-sky-100 bg-white">
                  <div className="aspect-square w-full animate-pulse bg-sky-100/70" />
                </div>
                <div className="flex min-h-[220px] flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-sky-950">Загружаем изображение из источника</p>
                    <p className="text-[12px] text-sky-900/75">
                      Это может занять несколько секунд. Изображение появится автоматически.
                    </p>
                  </div>
                  <div className="inline-flex w-fit items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-[12px] font-medium text-sky-800">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Загружаем...
                  </div>
                </div>
              </>
            ) : null}

            {mediaStatus === "loaded" && importedCoverCandidateUrl ? (
              <>
                <div className="overflow-hidden rounded-xl border border-sky-100 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={importedCoverCandidateUrl}
                    alt="Постер из источника"
                    className="aspect-square w-full object-cover"
                  />
                </div>
                <div className="flex min-h-[220px] flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-sky-950">Постер найден в источнике</p>
                    <p className="text-[12px] text-sky-900/75">
                      Это изображение можно сразу использовать как обложку события.
                    </p>
                    <p className="text-[12px] text-sky-900/60">
                      При применении изображение будет сохранено в медиатеку.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!isEditable || isApplyingImportedCover}
                      onClick={() => void applyImportedCover(importedCoverCandidateUrl)}
                    >
                      {isApplyingImportedCover ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {data.coverImage || coverPreview ? "Заменить на изображение из источника" : "Применить как обложку"}
                    </Button>
                  </div>
                  {chosenImportedCoverUrl === importedCoverCandidateUrl ? (
                    <div className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[12px] font-medium text-emerald-800">
                      <Check className="h-3.5 w-3.5" />
                      Обложка выбрана из источника
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {mediaStatus === "empty" ? (
              <>
                <div className="overflow-hidden rounded-xl border border-sky-100 bg-white">
                  <div className="aspect-square w-full bg-sky-100/40" />
                </div>
                <div className="flex min-h-[220px] flex-col justify-center gap-2">
                  <p className="text-sm font-medium text-sky-950">Изображение не найдено</p>
                  <p className="text-[12px] text-sky-900/75">
                    Вы можете загрузить изображение вручную или выбрать из медиатеки.
                  </p>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {mediaStatus === "loaded" && importedGalleryCandidates.length > 0 ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-sky-950">Дополнительные изображения из источника</h3>
            <ImportBadge />
          </div>
          <p className="mb-4 text-[12px] text-sky-900/75">
            Изображения найдены в источнике. Их можно добавить в галерею в один клик.
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {importedGalleryCandidates.map((url) => {
              const isSelected = selectedImportedUrl === url;
              const isGalleryChosen = chosenImportedGalleryUrls.includes(url);
              const isApplyingGallery = applyingImportedGalleryUrls.includes(url);
              return (
                <div
                  key={url}
                  className={cn(
                    "rounded-xl border bg-white p-2 transition-colors",
                    isSelected ? "border-sky-500 ring-2 ring-sky-200" : "border-sky-100 hover:border-sky-300",
                    isGalleryChosen ? "shadow-sm" : "",
                  )}
                >
                  <button
                    type="button"
                    className="relative block w-full overflow-hidden rounded-lg"
                    onClick={() => setSelectedImportedUrl(url)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="aspect-square w-full object-cover" />
                    <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                      {isGalleryChosen ? <MediaSourceBadge label="Галерея" /> : null}
                    </div>
                    {isSelected ? <div className="absolute inset-0 ring-2 ring-inset ring-sky-500" /> : null}
                  </button>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={!isEditable || isApplyingGallery}
                      onClick={() => void applyImportedGallery([url])}
                    >
                      {isApplyingGallery ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Добавить в галерею
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-medium">
          Главное изображение <span className="text-red-500">*</span>
        </h3>
        <p className="mb-3 text-[12px] text-muted-foreground">Выберите обложку из источника, медиатеки или загрузите новый файл.</p>

        <MediaDropzone
          ref={coverDropzoneRef}
          selectionMode="cover"
          isEditable={isEditable}
          isBusy={isUploadingCover}
          isDragging={isDraggingCover}
          onDraggingChange={setIsDraggingCover}
          onFilesSelected={handleCoverFilesSelect}
        >
          {({ openFilePicker }) =>
            isUploadingCover ? (
              <div className="space-y-3">
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                <p className="text-sm text-gray-600">Загрузка...</p>
              </div>
            ) : coverPreview || data.coverImage ? (
              <div className="space-y-4">
                <div className="relative inline-block">
                  {(() => {
                    const previewUrl =
                      coverPreview || (data.coverImage ? getMediaAssetPreviewUrl({ id: data.coverImage }) : "");

                    if (!previewUrl || coverPreviewUnavailable) {
                      return (
                        <div className="mx-auto flex h-40 w-40 flex-col items-center justify-center rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 p-4 text-center">
                          <p className="text-xs font-medium text-amber-900">
                            Изображение недоступно
                          </p>
                          <p className="mt-1 text-[10px] text-amber-700">
                            Выберите другое изображение из медиатеки или загрузите новый файл.
                          </p>
                        </div>
                      );
                    }

                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt="Cover preview"
                        className="mx-auto h-40 w-40 rounded-lg object-cover"
                        onError={() => {
                          console.error("[EventWizardMedia] Cover image failed to load", {
                            src: previewUrl,
                            coverPreview,
                            coverImage: data.coverImage,
                          });
                          setCoverPreviewUnavailable(true);
                        }}
                      />
                    );
                  })()}
                  {isEditable ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCoverRemove();
                      }}
                      className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white hover:bg-red-700"
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={!isEditable} onClick={(e) => {
                    e.stopPropagation();
                    openPicker("cover");
                  }}>
                    Выбрать из медиатеки
                  </Button>
                  <Button type="button" size="sm" variant="secondary" disabled={!isEditable} onClick={(e) => {
                    e.stopPropagation();
                    openFilePicker();
                  }}>
                    Загрузить новое
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={!isEditable}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCoverRemove();
                    }}
                  >
                    Удалить
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="text-[12px] text-gray-600">Выберите главное изображение из медиатеки или загрузите файл</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={!isEditable} onClick={(e) => {
                    e.stopPropagation();
                    openPicker("cover");
                  }}>
                    Выбрать из медиатеки
                  </Button>
                  <Button type="button" size="sm" disabled={!isEditable} onClick={(e) => {
                    e.stopPropagation();
                    openFilePicker();
                  }}>
                    Загрузить файл
                  </Button>
                </div>
              </div>
            )
          }
        </MediaDropzone>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Галерея</h3>
        <p className="mb-3 text-[12px] text-muted-foreground">
          Добавьте дополнительные изображения из источника, медиатеки или загрузите их вручную.
        </p>

        {!hasRenderedGallery ? (
          <MediaDropzone
            selectionMode="gallery"
            isEditable={isEditable}
            isDragging={isDraggingGallery}
            onDraggingChange={setIsDraggingGallery}
            onFilesSelected={handleGalleryFilesSelect}
            className="mb-4"
          >
            {({ openFilePicker }) => (
              <div className="space-y-4">
                <ImagePlus className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="text-[12px] text-gray-600">Шаг не будет пустым: можно взять изображения из медиатеки или загрузить файлы</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={!isEditable} onClick={(e) => {
                    e.stopPropagation();
                    openPicker("gallery");
                  }}>
                    Выбрать из медиатеки
                  </Button>
                  <Button type="button" size="sm" disabled={!isEditable} onClick={(e) => {
                    e.stopPropagation();
                    openFilePicker();
                  }}>
                    Загрузить файл
                  </Button>
                </div>
              </div>
            )}
          </MediaDropzone>
        ) : null}

        {galleryItems.length > 0 ? (
          <>
            {isMounted ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={galleryItems.map((img) => img.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {galleryItems.map((image, index) => (
                      <SortableGalleryItem
                        key={image.id}
                        image={image}
                        index={index}
                        onRemove={handleGalleryRemove}
                        disabled={!isEditable}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {galleryItems.map((image, index) => (
                  <StaticGalleryItem key={image.id} image={image} index={index} onRemove={handleGalleryRemove} />
                ))}
              </div>
            )}
          </>
        ) : null}

      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Ссылка на reels / видео</h3>
        {trailerHint && !data.reelsUrl && (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-sky-950">Трейлер найден в источнике</p>
              <p className="mt-0.5 truncate font-mono text-[11px] text-sky-700">{trailerHint}</p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={!isEditable}
              onClick={() => onChange({ reelsUrl: trailerHint })}
            >
              Использовать
            </Button>
          </div>
        )}
        <Input
          type="url"
          value={data.reelsUrl || ""}
          onChange={(e) => onChange({ reelsUrl: e.target.value })}
          placeholder="https://youtube.com/... или https://instagram.com/..."
          disabled={!isEditable}
          className="!text-[13px]"
        />
        <p className="mt-2 text-[12px] text-muted-foreground">Добавьте ссылку на видео о событии</p>
      </div>

      <Dialog
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open);
          if (!open) setPickerSelection(new Set());
        }}
      >
        <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="px-6 pb-2 pt-6">
            <DialogTitle>{pickerMode === "cover" ? "Выбрать главное изображение" : "Выбрать изображения для галереи"}</DialogTitle>
            <DialogDescription>
              В этом окне объединены изображения из внутренней медиатеки и уже связанных с событием media assets.
            </DialogDescription>
          </DialogHeader>
          <div ref={pickerScrollRef} className="min-h-[220px] flex-1 overflow-y-auto px-6 pb-2">
            {pickerLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pickerItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                В медиатеке пока нет изображений. Загрузите файл и вернитесь к выбору.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {pickerItems.map((item) => {
                  const selected = pickerSelection.has(item.id);
                  const normalized = normalizeMediaImage(item);
                  const currentFieldIds = pickerMode === "cover" ? new Set([data.coverImage].filter(Boolean)) : new Set(data.gallery);
                  const selectedInCurrentField = currentFieldIds.has(item.id);
                  const usedElsewhere = !selectedInCurrentField && (item.isUsed === true || item.fromEntity === true);
                  const interactive = Boolean(normalized) && !selectedInCurrentField;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!interactive}
                      className={cn(
                        "group relative aspect-square overflow-hidden rounded-lg border bg-muted focus:outline-none focus:ring-2 focus:ring-primary",
                        usedElsewhere || selectedInCurrentField ? "border-[#EF8759]" : "border-border",
                        selected && interactive && "ring-2 ring-primary ring-offset-2",
                        !interactive && "cursor-not-allowed opacity-40",
                      )}
                      onClick={() => togglePickerSelection(item)}
                    >
                      {normalized ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={normalized.url} alt={normalized.alt ?? ""} className="h-full w-full object-cover transition group-hover:opacity-90" />
                      ) : null}
                      {selected ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                          <Check className="h-8 w-8 text-primary" />
                        </div>
                      ) : null}
                      {selectedInCurrentField || usedElsewhere ? (
                        <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-[#EF8759] px-2 py-1 text-[11px] font-medium text-white shadow-sm">
                          <Check className="h-3.5 w-3.5" />
                          {selectedInCurrentField ? "Уже выбрано" : "Используется"}
                        </span>
                      ) : null}
                      <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                        {item.fromEntity ? <MediaSourceBadge label="Используется" /> : null}
                        {item.showImportBadge ? <ImportBadge /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {generalPager.hasMore ? (
              <div ref={pickerSentinelRef} className="flex justify-center py-4">
                {generalPager.loadingMore ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : null}
              </div>
            ) : null}
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => setPickerOpen(false)}>
              Отмена
            </Button>
            <Button type="button" onClick={applyPickerSelection} disabled={pickerSelection.size === 0}>
              {pickerMode === "cover" ? "Выбрать изображение" : "Добавить выбранные"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
