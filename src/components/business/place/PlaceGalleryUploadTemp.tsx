/**
 * Place Gallery Upload (Wizard Session Mode)
 * Works without placeId - uploads to temp media storage
 */

"use client";

import { useState, useEffect } from "react";
import { Upload, X, Loader2, GripVertical } from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";
import { toast } from "sonner";
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

export interface GalleryItem {
  id: string;
  url: string;
  width?: number;
  height?: number;
  blurhash?: string;
  status: "uploading" | "done" | "error";
}

interface PlaceGalleryUploadTempProps {
  wizardSessionId: string;
  initialImages?: GalleryItem[];
  onImagesChange?: (images: GalleryItem[]) => void;
  disabled?: boolean;
}

// Sortable Image Item Component
function SortableImageItem({
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
      {image.status === "uploading" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : image.status === "error" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50">
          <p className="text-xs text-red-600">Ошибка</p>
        </div>
      ) : (
        <>
          <img
            src={image.url}
            alt={`Gallery ${index + 1}`}
            className="w-full h-full object-cover"
          />
          
          {/* Remove button */}
          <button
            onClick={() => onRemove(image.id)}
            className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 z-10"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="absolute top-2 left-2 p-1.5 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-move z-10"
          >
            <GripVertical className="h-4 w-4" />
          </div>

          {/* Photo number badge */}
          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-xs font-medium rounded">
            Фото {index + 1}
          </div>

          {/* Cover badge for first image */}
          {index === 0 && (
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-primary text-white text-xs rounded">
              Главное
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function PlaceGalleryUploadTemp({
  wizardSessionId,
  initialImages = [],
  onImagesChange,
  disabled = false,
}: PlaceGalleryUploadTempProps) {
  const [images, setImages] = useState<GalleryItem[]>(initialImages);
  const [isDragging, setIsDragging] = useState(false);

  const { uploadImage } = useImageUpload({
    maxSizeMB: 5,
    maxWidthOrHeight: 1920,
    quality: 0.9,
  });

  // Setup drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const reordered = arrayMove(items, oldIndex, newIndex);
        
        // Update sortOrder on server for all affected images
        updateSortOrder(reordered);
        
        return reordered;
      });
    }
  };

  // Update sortOrder on server
  const updateSortOrder = async (reorderedImages: GalleryItem[]) => {
    try {
      // Only update images that are "done" (have real IDs)
      const updates = reorderedImages
        .filter((img) => img.status === "done")
        .map((img, index) => ({
          id: img.id,
          sortOrder: index,
        }));

      if (updates.length === 0) return;

      const response = await fetch("/api/business/temp-media/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wizardSessionId,
          updates,
        }),
      });

      if (!response.ok) {
        console.error("Failed to update sort order");
      }
    } catch (error) {
      console.error("Sort order update error:", error);
    }
  };

  // Only call onImagesChange when images actually change (not on mount)
  useEffect(() => {
    // Filter to only "done" images for parent state
    const doneImages = images.filter(img => img.status === "done");
    onImagesChange?.(doneImages);
  }, [images]); // Remove onImagesChange from deps to prevent loop

  const handleFilesSelect = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    // Validate files
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

    // Add placeholder items
    const placeholders: GalleryItem[] = validFiles.map((file) => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      url: URL.createObjectURL(file),
      status: "uploading" as const,
    }));

    setImages((prev) => [...prev, ...placeholders]);

    // Upload files
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const placeholderId = placeholders[i].id;

      try {
        // Upload to CDN
        const uploadedImage = await uploadImage(file);

        if (!uploadedImage) {
          throw new Error("Failed to upload image");
        }

        // Save to temp media
        const response = await fetch("/api/business/temp-media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wizardSessionId,
            url: uploadedImage.url,
            width: uploadedImage.width,
            height: uploadedImage.height,
            blurhash: uploadedImage.blurhash,
            mimeType: file.type,
            sizeBytes: file.size,
            kind: "PLACE_GALLERY",
            sortOrder: images.length + i, // Maintain order based on current images + upload index
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to save image");
        }

        const { media } = await response.json();

        // Update placeholder with real data
        setImages((prev) =>
          prev.map((img) =>
            img.id === placeholderId
              ? {
                  id: media.id,
                  url: uploadedImage.url,
                  width: uploadedImage.width,
                  height: uploadedImage.height,
                  blurhash: uploadedImage.blurhash,
                  status: "done" as const,
                }
              : img
          )
        );
      } catch (error) {
        console.error("Gallery upload error:", error);
        
        // Mark as error
        setImages((prev) =>
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

  const handleClick = () => {
    if (disabled) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        handleFilesSelect(files);
      }
    };
    input.click();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFilesSelect(files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemove = async (imageId: string) => {
    if (disabled) return;
    // Optimistic update
    setImages((prev) => prev.filter((img) => img.id !== imageId));

    // Delete from server
    try {
      const response = await fetch(`/api/business/temp-media/${imageId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete image");
      }
    } catch (error) {
      console.error("Delete image error:", error);
      toast.error("Ошибка удаления фото");
      // TODO: Revert optimistic update
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onClick={!disabled ? handleClick : undefined}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-colors
          ${isDragging ? "border-primary bg-primary/5" : "border-gray-300"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted"}
        `}
      >
        <div className="space-y-3">
          <Upload className="mx-auto h-10 w-10 text-gray-400" />
          <div>
            <p className="text-sm text-gray-600">
              Перетащите фотографии сюда или нажмите для загрузки
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Можно загрузить несколько фото сразу
            </p>
          </div>
        </div>
      </div>

      {/* Gallery Grid with Drag and Drop */}
      {images.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={images.map((img) => img.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((image, index) => (
                <SortableImageItem
                  key={image.id}
                  image={image}
                  index={index}
                  onRemove={handleRemove}
                  disabled={disabled}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
