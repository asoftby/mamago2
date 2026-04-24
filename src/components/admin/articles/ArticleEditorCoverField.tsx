"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type PickerItem = { id: string; publicUrl: string | null; alt: string | null; title: string | null };

export function ArticleEditorCoverField({
  value,
  onChange,
  initialPreviewUrl,
  /** Скрыть заголовок «Обложка» (например, блок «Изображение» в теле статьи) */
  showHeading = true,
  /** Подпись основной кнопки в пустом состоянии */
  uploadButtonLabel = "Загрузить обложку",
  /** Тексты успеха (по умолчанию — для обложки статьи) */
  successUploadMessage = "Обложка загружена",
  successPickMessage = "Обложка выбрана",
}: {
  value: string;
  onChange: (mediaId: string, previewUrl: string | null) => void;
  initialPreviewUrl?: string | null;
  showHeading?: boolean;
  uploadButtonLabel?: string;
  successUploadMessage?: string;
  successPickMessage?: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialPreviewUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value.trim()) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/articles/media-preview?id=${encodeURIComponent(value.trim())}`);
      if (!res.ok) {
        if (!cancelled) setPreviewUrl(initialPreviewUrl ?? null);
        return;
      }
      const data = (await res.json()) as { publicUrl: string | null };
      if (!cancelled) setPreviewUrl(data.publicUrl ?? initialPreviewUrl ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [value, initialPreviewUrl]);

  const loadPicker = useCallback(async () => {
    setPickerLoading(true);
    try {
      const res = await fetch("/api/admin/articles/media-picker?limit=48");
      if (!res.ok) {
        toast.error("Не удалось загрузить медиатеку");
        return;
      }
      const data = (await res.json()) as { items: PickerItem[] };
      setPickerItems(data.items ?? []);
    } finally {
      setPickerLoading(false);
    }
  }, []);

  const openLibrary = () => {
    setLibraryOpen(true);
    void loadPicker();
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
        mediaId?: string | null;
      };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Ошибка загрузки");
        return;
      }
      const id = data.mediaId?.trim();
      if (!id) {
        toast.error("Файл загружен, но не получен ID медиа. Откройте медиатеку и выберите файл.");
        return;
      }
      onChange(id, data.url ?? null);
      setPreviewUrl(data.url ?? null);
      toast.success(successUploadMessage);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  };

  const pickFromLibrary = (item: PickerItem) => {
    if (!item.publicUrl) return;
    onChange(item.id, item.publicUrl);
    setPreviewUrl(item.publicUrl);
    setLibraryOpen(false);
    toast.success(successPickMessage);
  };

  const clearCover = () => {
    onChange("", null);
    setPreviewUrl(null);
  };

  const hasCover = !!value.trim() && !!previewUrl;

  return (
    <div className="space-y-3">
      {showHeading ? <Label className="text-base">Обложка</Label> : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          void onPickFile(f ?? null);
        }}
      />

      {!hasCover ? (
        <div
          className={cn(
            "flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/80 px-4 py-8 text-center transition-colors",
            !uploading && "hover:border-primary/40 hover:bg-muted/30",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const f = e.dataTransfer.files?.[0];
            if (f?.type.startsWith("image/")) void onPickFile(f);
          }}
        >
          <ImagePlus className="h-10 w-10 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Перетащите изображение сюда или загрузите файл</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {uploadButtonLabel}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={openLibrary}>
              Выбрать из медиатеки
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl!}
            alt=""
            className="max-h-56 w-full rounded-lg border border-gray-100 object-contain object-left"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={uploading} onClick={() => inputRef.current?.click()}>
              Заменить
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={openLibrary}>
              Выбрать из медиатеки
            </Button>
            <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={clearCover}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Удалить
            </Button>
          </div>
        </div>
      )}

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Выбор из медиатеки</DialogTitle>
            <DialogDescription>Недавно загруженные изображения. Полный список — в разделе «Медиатека».</DialogDescription>
          </DialogHeader>
          <div className="min-h-[200px] flex-1 overflow-y-auto px-6 pb-6">
            {pickerLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pickerItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Нет изображений. Загрузите файл или откройте медиатеку.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {pickerItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                    onClick={() => pickFromLibrary(item)}
                    disabled={!item.publicUrl}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.publicUrl!} alt="" className="h-full w-full object-cover transition group-hover:opacity-90" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
