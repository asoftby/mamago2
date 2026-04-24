"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Check, ImagePlus, Loader2, Trash2 } from "lucide-react";
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

type PickerItem = { id: string; publicUrl: string | null; alt: string | null; title: string | null };

/** Кнопка удаления на превью: без рамки, liquid glass, красная иконка */
const galleryDeleteButtonClass =
  "h-8 w-8 shrink-0 rounded-full border-0 shadow-none bg-white/30 text-red-600 backdrop-blur-xl backdrop-saturate-150 ring-1 ring-white/35 hover:bg-white/45 hover:text-red-700 hover:ring-white/50 dark:bg-white/15 dark:ring-white/20 dark:hover:bg-white/25";

type GalleryRow =
  | {
      type: "local";
      clientId: string;
      file: File;
      previewUrl: string;
    }
  | {
      type: "remote";
      mediaId: string;
      fallbackUrl?: string;
    };

function remoteIdsFromRows(rows: GalleryRow[]): string[] {
  return rows.filter((r): r is Extract<GalleryRow, { type: "remote" }> => r.type === "remote").map(
    (r) => r.mediaId,
  );
}

function GalleryThumb({
  mediaId,
  fallbackPublicUrl,
  onRemove,
}: {
  mediaId: string;
  fallbackPublicUrl?: string | null;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState<string | null>(() => fallbackPublicUrl?.trim() || null);
  const [previewReady, setPreviewReady] = useState(false);

  useEffect(() => {
    const fb = fallbackPublicUrl?.trim();
    if (fb) setUrl((u) => u ?? fb);
  }, [fallbackPublicUrl, mediaId]);

  useEffect(() => {
    let cancelled = false;
    setPreviewReady(false);
    (async () => {
      try {
        const res = await fetch(`/api/admin/articles/media-preview?id=${encodeURIComponent(mediaId)}`, {
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) {
            setUrl((u) => u ?? fallbackPublicUrl?.trim() ?? null);
          }
          return;
        }
        const data = (await res.json()) as { publicUrl: string | null };
        if (!cancelled) setUrl(data.publicUrl ?? fallbackPublicUrl?.trim() ?? null);
      } finally {
        if (!cancelled) setPreviewReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mediaId, fallbackPublicUrl]);

  return (
    <div className="group relative overflow-hidden rounded-lg border border-gray-200 bg-muted">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="aspect-square h-28 w-full object-cover sm:h-32" />
      ) : !previewReady ? (
        <div className="flex aspect-square h-28 w-full items-center justify-center sm:h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex aspect-square h-28 w-full items-center justify-center p-2 text-center text-xs text-muted-foreground sm:h-32">
          Нет превью
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/50 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(galleryDeleteButtonClass)}
          onClick={onRemove}
          aria-label="Убрать из галереи"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.25} />
        </Button>
      </div>
    </div>
  );
}

function LocalPreviewTile({
  previewUrl,
  label,
  uploading,
  onRemove,
}: {
  previewUrl: string;
  label: string;
  uploading?: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-dashed border-primary/30 bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={previewUrl} alt="" className="aspect-square h-28 w-full object-cover sm:h-32" />
      {uploading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/35">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      ) : null}
      <p className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-center text-[10px] text-white">
        {label}
      </p>
      <div className="absolute inset-x-0 bottom-8 flex justify-end p-1 opacity-0 transition group-hover:opacity-100">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(galleryDeleteButtonClass)}
          onClick={onRemove}
          disabled={uploading}
          aria-label="Убрать из очереди"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.25} />
        </Button>
      </div>
    </div>
  );
}

export function ArticleEditorGalleryField({
  value,
  onChange,
  showHeading = true,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  showHeading?: boolean;
}) {
  const [rows, setRows] = useState<GalleryRow[]>(() =>
    value.map((id) => ({ type: "remote" as const, mediaId: id })),
  );
  /** Совпадает с последним onChange(ids.join) — чтобы не сбрасывать rows при собственном обновлении родителя */
  const lastEmittedSigRef = useRef(value.join("|"));
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [uploadBusy, setUploadBusy] = useState(false);
  const uploadChainRef = useRef(Promise.resolve());

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);
  const [librarySelectedIds, setLibrarySelectedIds] = useState<Set<string>>(() => new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const emit = useCallback(
    (nextRows: GalleryRow[]) => {
      const ids = remoteIdsFromRows(nextRows);
      lastEmittedSigRef.current = ids.join("|");
      onChange(ids);
    },
    [onChange],
  );

  /** Внешнее изменение value (загрузка статьи и т.д.) — подставляем remotes, сохраняем локальные превью */
  useEffect(() => {
    const incoming = value.join("|");
    if (incoming === lastEmittedSigRef.current) return;
    setRows((prev) => {
      const locals = prev.filter((r): r is Extract<GalleryRow, { type: "local" }> => r.type === "local");
      const remotes = value.map((id) => ({ type: "remote" as const, mediaId: id }));
      return [...locals, ...remotes];
    });
    lastEmittedSigRef.current = incoming;
  }, [value]);

  useEffect(() => {
    return () => {
      for (const r of rowsRef.current) {
        if (r.type === "local") revokeLocal(r);
      }
    };
  }, []);

  const revokeLocal = (row: Extract<GalleryRow, { type: "local" }>) => {
    try {
      URL.revokeObjectURL(row.previewUrl);
    } catch {
      /* ignore */
    }
  };

  const loadPicker = useCallback(async () => {
    setPickerLoading(true);
    try {
      const res = await fetch("/api/admin/articles/media-picker?limit=48", {
        credentials: "include",
      });
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
    setLibrarySelectedIds(new Set());
    setLibraryOpen(true);
    void loadPicker();
  };

  const toggleLibrarySelection = (item: PickerItem) => {
    if (!item.publicUrl || value.includes(item.id)) return;
    setLibrarySelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const addSelectedFromLibrary = () => {
    const ids: string[] = [];
    for (const id of librarySelectedIds) {
      if (value.includes(id)) continue;
      const item = pickerItems.find((p) => p.id === id);
      if (!item?.publicUrl) continue;
      ids.push(id);
    }
    if (ids.length === 0) {
      toast.message("Отметьте изображения галочками");
      return;
    }
    setRows((prev) => {
      const toAdd = ids.map((id) => ({ type: "remote" as const, mediaId: id }));
      const merged = [
        ...prev,
        ...toAdd.filter((row) => !prev.some((r) => r.type === "remote" && r.mediaId === row.mediaId)),
      ];
      emit(merged);
      return merged;
    });
    toast.success(
      ids.length === 1 ? "Добавлено в галерею" : `Добавлено изображений: ${ids.length}`,
    );
    setLibraryOpen(false);
    setLibrarySelectedIds(new Set());
  };

  /** Загружает только переданные clientId; очередь — чтобы не было гонок при повторном выборе файлов */
  const uploadLocalByClientIds = (clientIds: string[]) => {
    if (clientIds.length === 0) return;
    uploadChainRef.current = uploadChainRef.current.then(async () => {
      setUploadBusy(true);
      let okCount = 0;
      try {
        for (const clientId of clientIds) {
          const local = rowsRef.current.find(
            (r): r is Extract<GalleryRow, { type: "local" }> =>
              r.type === "local" && r.clientId === clientId,
          );
          if (!local) continue;

          const fd = new FormData();
          fd.append("file", local.file);
          const res = await fetch("/api/upload", {
            method: "POST",
            body: fd,
            credentials: "include",
          });
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            url?: string;
            mediaId?: string | null;
          };
          if (!res.ok) {
            toast.error(
              typeof data.error === "string" ? data.error : `Ошибка загрузки: ${local.file.name}`,
            );
            continue;
          }
          const rawId = data.mediaId;
          const mediaId = rawId != null ? String(rawId).trim() : "";
          if (!mediaId) {
            toast.error(`«${local.file.name}»: нет ID медиа.`);
            continue;
          }
          const fallback = typeof data.url === "string" ? data.url.trim() : undefined;

          setRows((prev) => {
            const duplicateRemote = prev.some((r) => r.type === "remote" && r.mediaId === mediaId);
            const next = prev
              .map((r) => {
                if (r.type === "local" && r.clientId === clientId) {
                  if (duplicateRemote) {
                    revokeLocal(r);
                    return null;
                  }
                  revokeLocal(r);
                  return { type: "remote" as const, mediaId, fallbackUrl: fallback };
                }
                return r;
              })
              .filter((r): r is GalleryRow => r != null);
            emit(next);
            return next;
          });
          okCount++;
        }
        if (okCount > 0) {
          toast.success(
            okCount === 1 ? "Изображение добавлено в галерею" : `Загружено изображений: ${okCount}`,
          );
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        setUploadBusy(false);
      }
    });
  };

  const handleFiles = (fileList: FileList | File[] | null) => {
    const files = Array.from(fileList ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) {
      toast.error("Нужны файлы изображений");
      return;
    }
    const added: GalleryRow[] = files.map((file) => ({
      type: "local" as const,
      clientId: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    const clientIds = added
      .filter((r): r is Extract<GalleryRow, { type: "local" }> => r.type === "local")
      .map((a) => a.clientId);
    flushSync(() => {
      setRows((prev) => [...prev, ...added]);
    });
    void uploadLocalByClientIds(clientIds);
  };

  const removeAt = (index: number) => {
    setRows((prev) => {
      const row = prev[index];
      if (!row) return prev;
      const next = prev.filter((_, i) => i !== index);
      if (row.type === "local") {
        revokeLocal(row);
      }
      emit(next);
      return next;
    });
  };

  const hasItems = rows.length > 0;

  return (
    <div className="space-y-3">
      {showHeading ? (
        <Label className="text-base">Галерея</Label>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = "";
          handleFiles(files);
        }}
      />

      {!hasItems ? (
        <div
          className={cn(
            "flex min-h-[140px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/80 px-4 py-8 text-center transition-colors",
            !uploadBusy && "hover:border-primary/40 hover:bg-muted/30",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleFiles(e.dataTransfer.files);
          }}
        >
          <ImagePlus className="h-10 w-10 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Перетащите изображения сюда или выберите несколько файлов — превью появятся сразу
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" size="sm" disabled={uploadBusy} onClick={() => inputRef.current?.click()}>
              {uploadBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Загрузить изображения
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={uploadBusy} onClick={openLibrary}>
              Выбрать из медиатеки
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {rows.map((row, i) =>
              row.type === "local" ? (
                <LocalPreviewTile
                  key={row.clientId}
                  previewUrl={row.previewUrl}
                  label={row.file.name}
                  uploading={uploadBusy}
                  onRemove={() => removeAt(i)}
                />
              ) : (
                <GalleryThumb
                  key={row.mediaId}
                  mediaId={row.mediaId}
                  fallbackPublicUrl={row.fallbackUrl}
                  onRemove={() => removeAt(i)}
                />
              ),
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={uploadBusy} onClick={() => inputRef.current?.click()}>
              {uploadBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Загрузить изображения
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={uploadBusy} onClick={openLibrary}>
              Выбрать из медиатеки
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={libraryOpen}
        onOpenChange={(open) => {
          setLibraryOpen(open);
          if (!open) setLibrarySelectedIds(new Set());
        }}
      >
        <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="px-6 pb-2 pt-6">
            <DialogTitle>Выбрать из медиатеки</DialogTitle>
            <DialogDescription>
              Клик по превью — отметить несколько изображений, затем «Добавить выбранные». Уже в галерее —
              неактивны.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-[200px] flex-1 overflow-y-auto px-6 pb-2">
            {pickerLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pickerItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Нет изображений. Загрузите файл или откройте медиатеку.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {pickerItems.map((item) => {
                  const already = value.includes(item.id);
                  const selected = librarySelectedIds.has(item.id);
                  const canInteract = Boolean(item.publicUrl) && !already;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!canInteract}
                      className={cn(
                        "group relative aspect-square overflow-hidden rounded-lg border bg-muted focus:outline-none focus:ring-2 focus:ring-primary",
                        already && "cursor-not-allowed border-border opacity-40",
                        !already && "border-border",
                        selected && canInteract && "ring-2 ring-primary ring-offset-2",
                      )}
                      onClick={() => toggleLibrarySelection(item)}
                      title={already ? "Уже в галерее" : selected ? "Снять выбор" : "Добавить в выбор"}
                    >
                      {item.publicUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.publicUrl}
                          alt=""
                          className={cn(
                            "h-full w-full object-cover transition",
                            canInteract && "group-hover:opacity-90",
                          )}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] text-muted-foreground">
                          Нет превью
                        </div>
                      )}
                      {already ? (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-xs font-medium text-white">
                          Есть
                        </span>
                      ) : selected ? (
                        <span className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                          <Check className="h-4 w-4" aria-hidden />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter className="flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Выбрано: {librarySelectedIds.size}
            </p>
            <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
              <Button type="button" variant="outline" onClick={() => setLibraryOpen(false)}>
                Отмена
              </Button>
              <Button
                type="button"
                disabled={librarySelectedIds.size === 0}
                onClick={addSelectedFromLibrary}
              >
                Добавить выбранные
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
