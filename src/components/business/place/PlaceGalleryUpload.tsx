"use client";

import { useState } from "react";
import { Upload, X, Loader2, GripVertical, Image as ImageIcon } from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";
import { toast } from "@/lib/toast";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

export interface GalleryItem {
  id: string;
  file?: File;
  url?: string;
  width?: number;
  height?: number;
  blurhash?: string;
  status: "idle" | "uploading" | "done" | "error";
  error?: string;
}

interface PlaceGalleryUploadProps {
  placeId: string;
  initialImages?: GalleryItem[];
  onImagesChange?: (images: GalleryItem[]) => void;
  onSaveDraft?: () => Promise<boolean>; // Optional - for creating place before upload
}

export function PlaceGalleryUpload({
  placeId,
  initialImages = [],
  onImagesChange,
  onSaveDraft,
}: PlaceGalleryUploadProps) {
  const [images, setImages] = useState<GalleryItem[]>(initialImages);
  const [isDragging, setIsDragging] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Check if place exists
  const placeExists = placeId && placeId !== "new";

  const handleSaveDraftClick = async () => {
    if (!onSaveDraft) return;
    
    setIsSavingDraft(true);
    try {
      await onSaveDraft();
      toast.success("Черновик сохранён. Теперь можно загружать фото.");
    } catch (error) {
      console.error("Save draft error:", error);
      toast.error("Ошибка сохранения черновика");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const { uploadImage } = useImageUpload({
    maxSizeMB: 5,
    maxWidthOrHeight: 2048,
    quality: 0.9,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    // Create temporary items with preview
    const newItems: GalleryItem[] = fileArray.map((file) => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      file,
      url: URL.createObjectURL(file),
      status: "uploading" as const,
    }));

    const updatedImages = [...images, ...newItems];
    setImages(updatedImages);
    onImagesChange?.(updatedImages);

    // Upload each file
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const file = item.file!;

      try {
        // Validate file type
        if (!file.type.startsWith("image/")) {
          throw new Error("Пожалуйста, выберите изображение");
        }

        // Upload to CDN
        const uploadedImage = await uploadImage(file);
        
        if (!uploadedImage) {
          throw new Error("Failed to upload image");
        }

        // Save to Place via API
        const response = await fetch(`/api/business/places/${placeId}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: uploadedImage.url,
            width: uploadedImage.width,
            height: uploadedImage.height,
            blurhash: uploadedImage.blurhash,
            kind: "GALLERY",
            sortOrder: images.length + i,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to save image");
        }

        const data = await response.json();

        // Update item status
        setImages((prev) => {
          const updated = prev.map((img) =>
            img.id === item.id
              ? {
                  ...img,
                  id: data.image.id,
                  url: uploadedImage.url,
                  width: uploadedImage.width,
                  height: uploadedImage.height,
                  blurhash: uploadedImage.blurhash,
                  status: "done" as const,
                  file: undefined,
                }
              : img
          );
          onImagesChange?.(updated);
          return updated;
        });

        toast.success("Фото загружено");
      } catch (error) {
        console.error("Gallery upload error:", error);
        
        // Update item with error
        setImages((prev) => {
          const updated = prev.map((img) =>
            img.id === item.id
              ? {
                  ...img,
                  status: "error" as const,
                  error: error instanceof Error ? error.message : "Ошибка загрузки",
                }
              : img
          );
          onImagesChange?.(updated);
          return updated;
        });

        toast.error(error instanceof Error ? error.message : "Ошибка загрузки");
      }
    }
  };

  const handleClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        handleFileSelect(files);
      }
    };
    input.click();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files) {
      handleFileSelect(files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemove = async (id: string) => {
    const item = images.find((img) => img.id === id);
    
    if (item && item.status === "done" && !id.startsWith("temp-")) {
      // Delete from server
      try {
        const response = await fetch(`/api/business/places/${placeId}/images/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete image");
        }

        toast.success("Фото удалено");
      } catch (error) {
        console.error("Delete error:", error);
        toast.error("Ошибка удаления");
        return;
      }
    }

    // Remove from state
    const updated = images.filter((img) => img.id !== id);
    setImages(updated);
    onImagesChange?.(updated);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const reordered = arrayMove(items, oldIndex, newIndex);
        onImagesChange?.(reordered);
        
        // TODO: Update sortOrder on server
        // This can be done via batch update API endpoint
        
        return reordered;
      });
    }
  };

  return (
    <div className="space-y-4">
      {!placeExists && onSaveDraft ? (
        // Show message when place doesn't exist yet
        <div className="border-2 border-dashed rounded-xl p-10 text-center bg-muted/30">
          <div className="space-y-4">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">
                Чтобы загрузить фото, сначала сохраните место как черновик
              </p>
              <p className="text-xs text-muted-foreground">
                Это нужно для привязки фотографий к месту
              </p>
            </div>
            <button
              onClick={handleSaveDraftClick}
              disabled={isSavingDraft}
              className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSavingDraft ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                "Сохранить черновик"
              )}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Upload Zone */}
          <div
            onClick={handleClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer",
              "transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-gray-300",
              "hover:bg-muted"
            )}
          >
            <div className="space-y-3">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-600">
                Перетащите фото сюда или нажмите для загрузки
              </p>
              <p className="text-xs text-gray-500">
                Можно выбрать несколько фото
              </p>
            </div>
          </div>

          {/* Gallery Grid */}
          {images.length > 0 && (
            <div className="space-y-3">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
              items={images.map((img) => img.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map((image, index) => (
                  <GalleryImageCard
                    key={image.id}
                    image={image}
                    isCover={index === 0}
                    onRemove={() => handleRemove(image.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <p className="text-xs text-muted-foreground text-center">
            Обложка — первая фотография. Перетащите фото, чтобы изменить порядок.
          </p>
        </div>
      )}
        </>
      )}
    </div>
  );
}

interface GalleryImageCardProps {
  image: GalleryItem;
  isCover: boolean;
  onRemove: () => void;
}

function GalleryImageCard({ image, isCover, onRemove }: GalleryImageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative aspect-square rounded-lg overflow-hidden border-2",
        isDragging ? "opacity-50 border-primary" : "border-gray-200",
        "group"
      )}
    >
      {/* Image */}
      {image.url ? (
        <img
          src={image.url}
          alt=""
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <ImageIcon className="h-8 w-8 text-gray-400" />
        </div>
      )}

      {/* Cover Badge */}
      {isCover && (
        <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-md font-medium">
          Обложка
        </div>
      )}

      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 p-1 bg-white/90 rounded cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="h-4 w-4 text-gray-600" />
      </div>

      {/* Remove Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute bottom-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Loading Overlay */}
      {image.status === "uploading" && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        </div>
      )}

      {/* Error Overlay */}
      {image.status === "error" && (
        <div className="absolute inset-0 bg-red-50/90 flex items-center justify-center p-2">
          <p className="text-xs text-red-600 text-center">{image.error}</p>
        </div>
      )}
    </div>
  );
}
