/**
 * Place Logo Upload (Wizard Session Mode)
 * Works without placeId - uploads to temp media storage
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";
import { toast } from "@/lib/toast";
import { UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads/uploadConfig";

interface PlaceLogoUploadTempProps {
  wizardSessionId: string;
  currentLogoUrl?: string | null;
  onUploadComplete?: (mediaId: string, url: string) => void;
  disabled?: boolean;
}

export function PlaceLogoUploadTemp({
  wizardSessionId,
  currentLogoUrl,
  onUploadComplete,
  disabled = false,
}: PlaceLogoUploadTempProps) {
  const [preview, setPreview] = useState<string | null>(currentLogoUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const hasRestoredTempMedia = useRef(false); // Track if temp media was restored (use ref to avoid re-renders)

  const { uploadImage } = useImageUpload({
    maxSizeMB: 5,
    maxWidthOrHeight: 1024,
    quality: 0.9,
  });

  // Load temp media from session on mount
  useEffect(() => {
    const loadTempMedia = async () => {
      if (!wizardSessionId) {
        setIsLoadingSession(false);
        if (currentLogoUrl) {
          setPreview(currentLogoUrl);
        }
        return;
      }

      try {
        const response = await fetch(`/api/business/temp-media?wizardSessionId=${wizardSessionId}`);
        if (response.ok) {
          const { media } = await response.json();
          const logoMedia = media.find((m: { kind: string; url: string; id: string }) => m.kind === "PLACE_LOGO");
          
          if (logoMedia) {
            console.log("[PlaceLogoUploadTemp] Restored logo from session:", logoMedia.url);
            setPreview(logoMedia.url);
            hasRestoredTempMedia.current = true; // Mark that temp media was restored
            // Don't call onUploadComplete here - it causes infinite loop
            // onUploadComplete is only for new uploads, not for restoration
          } else if (currentLogoUrl) {
            console.log("[PlaceLogoUploadTemp] No temp logo, using current logo");
            setPreview(currentLogoUrl);
          }
        }
      } catch (error) {
        console.error("[PlaceLogoUploadTemp] Failed to load temp media:", error);
        if (currentLogoUrl) {
          setPreview(currentLogoUrl);
        }
      } finally {
        setIsLoadingSession(false);
      }
    };

    loadTempMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardSessionId]); // Only run when wizardSessionId changes

  useEffect(() => {
    if (currentLogoUrl && !isLoadingSession) {
      setPreview(currentLogoUrl);
    }
  }, [currentLogoUrl, isLoadingSession]);

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
          kind: "PLACE_LOGO",
          sortOrder: 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[PlaceLogoUploadTemp] API error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        throw new Error(errorData.error || `Failed to save logo (${response.status})`);
      }

      const { media } = await response.json();
      
      console.log("[PlaceLogoUploadTemp] Upload complete:", {
        mediaId: media.id,
        url: uploadedImage.url,
        isRealUpload: true,
        hasRestoredBefore: hasRestoredTempMedia.current,
      });
      
      setPreview(uploadedImage.url);
      
      // This is a real upload (not restoration), so call onUploadComplete
      if (onUploadComplete) {
        console.log("[PlaceLogoUploadTemp] Calling onUploadComplete");
        onUploadComplete(media.id, uploadedImage.url);
      } else {
        console.warn("[PlaceLogoUploadTemp] onUploadComplete is not defined!");
      }
      
      toast.success("Логотип загружен");
    } catch (error) {
      console.error("Logo upload error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка загрузки");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    if (disabled) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = UPLOAD_IMAGE_ACCEPT;
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

    if (isUploading || disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isUploading && !disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemove = () => {
    if (disabled) return;
    setPreview(null);
    // TODO: Call DELETE API to mark temp media as deleted
  };

  return (
    <div
      onClick={!isUploading && !disabled ? handleClick : undefined}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
        transition-colors
        ${isDragging ? "border-primary bg-primary/5" : "border-gray-300"}
        ${isUploading || disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted"}
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
  );
}
