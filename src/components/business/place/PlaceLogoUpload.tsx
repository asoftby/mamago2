"use client";

import { useState, useEffect } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { useImageUpload, type UploadedImage } from "@/hooks/useImageUpload";
import { toast } from "sonner";

interface PlaceLogoUploadProps {
  placeId: string;
  currentLogoUrl?: string | null;
  onUploadComplete?: (imageId: string, images: any[]) => void;
  onSaveDraft?: () => Promise<boolean>; // Optional - for creating place before upload
}

export function PlaceLogoUpload({
  placeId,
  currentLogoUrl,
  onUploadComplete,
  onSaveDraft,
}: PlaceLogoUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentLogoUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const { uploadImage } = useImageUpload({
    maxSizeMB: 5,
    maxWidthOrHeight: 1024,
    quality: 0.9,
  });

  useEffect(() => {
    if (currentLogoUrl) {
      setPreview(currentLogoUrl);
    }
  }, [currentLogoUrl]);

  // Check if place exists (placeId is valid)
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

  const handleFileSelect = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Пожалуйста, выберите изображение");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Размер файла не должен превышать 5MB");
      return;
    }

    setIsUploading(true);

    try {
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
          kind: "LOGO",
          sortOrder: 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save logo");
      }

      const data = await response.json();
      
      console.log("[PlaceLogoUpload] Upload complete:", {
        imageId: data.image.id,
        imagesCount: data.images?.length || 0,
      });
      
      setPreview(uploadedImage.url);
      
      // Pass both imageId and updated images array to parent
      onUploadComplete?.(data.image.id, data.images || []);
      
      toast.success("Логотип загружен");
    } catch (error) {
      console.error("Logo upload error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка загрузки");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    };
    input.click();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (isUploading) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemove = async () => {
    // TODO: Implement remove logo API call if needed
    setPreview(null);
  };

  return (
    <>
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
        // Normal upload UI when place exists
        <div
          onClick={!isUploading ? handleClick : undefined}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
            transition-colors
            ${isDragging ? "border-primary bg-primary/5" : "border-gray-300"}
            ${isUploading ? "opacity-50 cursor-not-allowed" : "hover:bg-muted"}
          `}
        >
          {isUploading ? (
            <div className="space-y-3">
              <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" />
              <p className="text-sm text-gray-600">Загрузка...</p>
            </div>
          ) : preview ? (
            <div className="space-y-3">
              <div className="relative inline-block">
                <img
                  src={preview}
                  alt="Logo preview"
                  className="mx-auto h-32 w-32 object-cover rounded-lg"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove();
                  }}
                  className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Нажмите или перетащите для замены
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-600">
                Перетащите логотип сюда или нажмите для загрузки
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
