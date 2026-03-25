"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Upload, X, Loader2, GripVertical } from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import type { EventFormData } from "../types";
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

interface Step3MediaProps {
  data: EventFormData;
  onChange: (updates: Partial<EventFormData>) => void;
  isEditable: boolean;
  wizardSessionId?: string;
}

interface GalleryItem {
  id: string;
  url: string;
  status: "uploading" | "done" | "error";
}

// Sortable Gallery Item
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id, disabled: disabled || image.status !== "done" });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group"
    >
      <GalleryItemContent 
        image={image} 
        index={index} 
        onRemove={onRemove} 
        showDragHandle={true}
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
    <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group">
      <GalleryItemContent 
        image={image} 
        index={index} 
        onRemove={onRemove} 
        showDragHandle={false}
      />
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
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
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
      <img
        src={image.url}
        alt={`Gallery ${index + 1}`}
        className="w-full h-full object-cover"
      />
      
      <button
        onClick={() => onRemove(image.id)}
        className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 z-10"
        type="button"
      >
        <X className="h-4 w-4" />
      </button>

      {showDragHandle && (
        <div
          {...dragHandleProps}
          className="absolute top-2 left-2 p-1.5 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-move z-10"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}

      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-xs font-medium rounded">
        Фото {index + 1}
      </div>
    </>
  );
}

export function Step3Media({ data, onChange, isEditable, wizardSessionId }: Step3MediaProps) {
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [isDraggingGallery, setIsDraggingGallery] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  const hasInitialized = useRef(false);

  const UPLOAD_TIMEOUT_MS = 120_000;

  function withUploadTimeout<T>(p: Promise<T>, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(
        () => reject(new Error(`${label}: превышено время ожидания`)),
        UPLOAD_TIMEOUT_MS,
      );
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
    maxSizeMB: 5,
    maxWidthOrHeight: 1920,
    quality: 0.9,
  });

  // Initialize gallery from data
  useEffect(() => {
    if (!hasInitialized.current && data.gallery.length > 0) {
      setGalleryItems(
        data.gallery.map((id) => ({
          id,
          url: `/api/media/${id}`, // TODO: Get actual URL
          status: "done" as const,
        }))
      );
      hasInitialized.current = true;
    }
  }, [data.gallery]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Setup drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setGalleryItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        
        // Update parent state
        onChange({ gallery: reordered.map(item => item.id) });
        
        return reordered;
      });
    }
  };

  // Cover Image Upload
  const handleCoverFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Пожалуйста, выберите изображение");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Размер файла не должен превышать 5MB");
      return;
    }

    setIsUploadingCover(true);

    try {
      const uploadedImage = await withUploadTimeout(
        uploadImage(file),
        "Обложка",
      );
      
      if (!uploadedImage) {
        throw new Error("Failed to upload image");
      }

      // `/api/media/[filename]` ищет медиа по `filename` в `mediaAsset`.
      // В url от `/api/upload` формат: `/uploads/<filename>`.
      const filename = uploadedImage.url.split("/").pop() || uploadedImage.id;

      setCoverPreview(uploadedImage.url);
      onChange({ coverImage: filename });
      toast.success("Обложка загружена");
    } catch (error) {
      console.error("Cover upload error:", error);
      toast.error(
        error instanceof Error ? error.message : "Ошибка загрузки обложки",
      );
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleCoverClick = () => {
    if (!isEditable) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleCoverFileSelect(file);
      }
    };
    input.click();
  };

  const handleCoverDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingCover(false);

    if (!isEditable || isUploadingCover) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleCoverFileSelect(file);
    }
  };

  const handleCoverRemove = () => {
    if (!isEditable) return;
    setCoverPreview(null);
    onChange({ coverImage: null });
  };

  // Gallery Upload
  const handleGalleryFilesSelect = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    const validFiles = fileArray.filter((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} не является изображением`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} превышает 5MB`);
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

    // Prevent closure issues: accumulate into local variable and write once per upload.
    let nextGallery = [...data.gallery];

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const placeholderId = placeholders[i].id;

      try {
        const uploadedImage = await withUploadTimeout(
          uploadImage(file),
          file.name,
        );

        if (!uploadedImage) {
          throw new Error("Failed to upload image");
        }

        // Use real filename (so `/api/media/[filename]` works after reload).
        const filename = uploadedImage.url.split("/").pop() || uploadedImage.id;

        setGalleryItems((prev) =>
          prev.map((img) =>
            img.id === placeholderId
              ? {
                  id: filename,
                  url: uploadedImage.url,
                  status: "done" as const,
                }
              : img
          )
        );

        // Update parent state
        onChange({ 
          gallery: [...nextGallery, filename]
        });
        nextGallery = [...nextGallery, filename];
      } catch (error) {
        console.error("Gallery upload error:", error);
        
        setGalleryItems((prev) =>
          prev.map((img) =>
            img.id === placeholderId
              ? { ...img, status: "error" as const }
              : img
          )
        );
        
        toast.error(`Ошибка загрузки ${file.name}`);
      }
    }
  };

  const handleGalleryClick = () => {
    if (!isEditable) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        handleGalleryFilesSelect(files);
      }
    };
    input.click();
  };

  const handleGalleryDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingGallery(false);

    if (!isEditable) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleGalleryFilesSelect(files);
    }
  };

  const handleGalleryRemove = (imageId: string) => {
    if (!isEditable) return;
    setGalleryItems((prev) => prev.filter((img) => img.id !== imageId));
    onChange({ gallery: data.gallery.filter((id) => id !== imageId) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Медиа</h2>
        <p className="text-[12px] text-muted-foreground">
          Добавьте фотографии и видео события
        </p>
      </div>

      {/* Cover Image */}
      <div>
        <h3 className="text-sm font-medium mb-2">
          Главное изображение <span className="text-red-500">*</span>
        </h3>
        <p className="text-[12px] text-muted-foreground mb-3">
          Добавьте обложку или главное фото вашего события
        </p>
        
        <div
          onClick={!isUploadingCover && isEditable ? handleCoverClick : undefined}
          onDrop={handleCoverDrop}
          onDragOver={(e) => {
            e.preventDefault();
            if (!isUploadingCover && isEditable) {
              setIsDraggingCover(true);
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDraggingCover(false);
          }}
          className={`
            border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
            transition-colors
            ${isDraggingCover ? "border-primary bg-primary/5" : "border-gray-300"}
            ${isUploadingCover || !isEditable ? "opacity-50 cursor-not-allowed" : "hover:bg-muted"}
          `}
        >
          {isUploadingCover ? (
            <div className="space-y-3">
              <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" />
              <p className="text-sm text-gray-600">Загрузка...</p>
            </div>
          ) : coverPreview || data.coverImage ? (
            <div className="space-y-3">
              <div className="relative inline-block">
                <img
                  src={coverPreview || `/api/media/${data.coverImage}`}
                  alt="Cover preview"
                  className="mx-auto h-32 w-32 object-cover rounded-lg"
                />
                {isEditable && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCoverRemove();
                    }}
                    className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-[12px] text-muted-foreground">
                Перетащите логотип сюда или нажмите для загрузки
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="text-[12px] text-gray-600">
                Перетащите логотип сюда или нажмите для загрузки
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Gallery */}
      <div>
        <h3 className="text-sm font-medium mb-2">Галерея</h3>
        <p className="text-[12px] text-muted-foreground mb-3">
          Добавьте дополнительные фотографии (необязательно)
        </p>

        <div
          onClick={isEditable ? handleGalleryClick : undefined}
          onDrop={handleGalleryDrop}
          onDragOver={(e) => {
            e.preventDefault();
            if (isEditable) {
              setIsDraggingGallery(true);
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDraggingGallery(false);
          }}
          className={`
            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
            transition-colors mb-4
            ${isDraggingGallery ? "border-primary bg-primary/5" : "border-gray-300"}
            ${!isEditable ? "opacity-50 cursor-not-allowed" : "hover:bg-muted"}
          `}
        >
          <div className="space-y-3">
            <Upload className="mx-auto h-10 w-10 text-gray-400" />
            <div>
              <p className="text-[12px] text-gray-600">
                Перетащите фотографии сюда или нажмите для загрузки
              </p>
              <p className="text-[12px] text-muted-foreground mt-1">
                Можно загрузить несколько фото сразу
              </p>
            </div>
          </div>
        </div>

        {galleryItems.length > 0 && (
          <>
            {isMounted ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={galleryItems.map((img) => img.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {galleryItems.map((image, index) => (
                  <StaticGalleryItem
                    key={image.id}
                    image={image}
                    index={index}
                    onRemove={handleGalleryRemove}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Video URL */}
      <div>
        <h3 className="text-sm font-medium mb-2">Ссылка на reels / видео</h3>
        <Input
          type="url"
          value={data.reelsUrl || ""}
          onChange={(e) => onChange({ reelsUrl: e.target.value })}
          placeholder="https://youtube.com/... или https://instagram.com/..."
          disabled={!isEditable}
          className="!text-[13px]"
        />
        <p className="text-[12px] text-muted-foreground mt-2">
          Добавьте ссылку на видео о событии
        </p>
      </div>
    </div>
  );
}
