/**
 * useImageUpload Hook
 * Unified hook for image compression and upload
 * Used for Place logo/gallery and Activity cover/gallery
 */

import { useState, useCallback } from "react";
import { compressImage, validateImageFile, type CompressedImage } from "@/lib/image/compression";
import { convertHeicFileToJpeg, isHeicFile } from "@/lib/uploads/heicConversion";
import { uploadMediaFile } from "@/lib/uploads/uploadClient";

export interface UploadedImage {
  /** Стабильный id из БД после загрузки; до ответа сервера — временный префикс `temp-`. */
  id: string;
  /** Публичный URL для превью (как в ответе `/api/upload`). */
  url: string;
  /** Id записи MediaAsset из ответа upload, если есть. */
  mediaId?: string;
  width: number;
  height: number;
  blurhash: string;
  preview: string;
  file?: File;
  uploading?: boolean;
  error?: string;
}

export interface UseImageUploadOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  onUploadComplete?: (image: UploadedImage) => void;
  onUploadError?: (error: string) => void;
}

export function useImageUpload(options?: UseImageUploadOptions) {
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const statusLabel = converting ? "Конвертируем…" : uploading ? "Загрузка…" : "";

  /**
   * Process and upload single image
   */
  const uploadImage = useCallback(
    async (file: File): Promise<UploadedImage | null> => {
      setUploading(true);
      setProgress(0);
      setError(null);

      try {
        // Validate file
        const validation = validateImageFile(file);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        setProgress(20);

        // Prebuilt sharp has no HEVC decoder, and that's what almost every
        // real iPhone HEIC photo is compressed with — convert to JPEG here
        // so the rest of this function (compression, upload) never has to
        // special-case HEIC at all.
        let workingFile = file;
        if (isHeicFile(file)) {
          setConverting(true);
          try {
            workingFile = await convertHeicFileToJpeg(file);
          } finally {
            setConverting(false);
          }
        }

        // Compress image (now always a browser-image-compression-supported format)
        const compressed = await compressImage(workingFile, {
          maxSizeMB: options?.maxSizeMB,
          maxWidthOrHeight: options?.maxWidthOrHeight,
          quality: options?.quality,
        });
        const fileToUpload = compressed.file;
        const imageWidth = compressed.width;
        const imageHeight = compressed.height;
        const blurhash = compressed.blurhash;
        const preview = compressed.preview;

        setProgress(50);

        const uploadData = await uploadMediaFile(fileToUpload);
        console.log("✅ [CLIENT] Upload successful:", uploadData);

        setProgress(100);

        const uploadedImage: UploadedImage = {
          id: uploadData.id || `temp-${Date.now()}`,
          url: uploadData.url,
          mediaId: uploadData.id,
          width: uploadData.width ?? imageWidth,
          height: uploadData.height ?? imageHeight,
          blurhash: blurhash,
          preview: preview || uploadData.url,
        };

        options?.onUploadComplete?.(uploadedImage);

        return uploadedImage;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Upload failed";
        setError(errorMessage);
        options?.onUploadError?.(errorMessage);
        return null;
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [options]
  );

  /**
   * Process and upload multiple images
   */
  const uploadImages = useCallback(
    async (files: File[]): Promise<UploadedImage[]> => {
      const results: UploadedImage[] = [];

      for (const file of files) {
        const result = await uploadImage(file);
        if (result) {
          results.push(result);
        }
      }

      return results;
    },
    [uploadImage]
  );

  /**
   * Compress image without uploading (for preview)
   */
  const compressOnly = useCallback(
    async (file: File): Promise<CompressedImage | null> => {
      try {
        setUploading(true);
        setError(null);

        const validation = validateImageFile(file);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        const compressed = await compressImage(file, {
          maxSizeMB: options?.maxSizeMB,
          maxWidthOrHeight: options?.maxWidthOrHeight,
          quality: options?.quality,
        });

        return compressed;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Compression failed";
        setError(errorMessage);
        return null;
      } finally {
        setUploading(false);
      }
    },
    [options]
  );

  return {
    uploadImage,
    uploadImages,
    compressOnly,
    uploading,
    converting,
    statusLabel,
    progress,
    error,
    clearError: () => setError(null),
  };
}

/**
 * Hook for managing multiple images (gallery)
 */
export function useImageGallery(initialImages: UploadedImage[] = []) {
  const [images, setImages] = useState<UploadedImage[]>(initialImages);

  const addImage = useCallback((image: UploadedImage) => {
    setImages((prev) => [...prev, image]);
  }, []);

  const addImages = useCallback((newImages: UploadedImage[]) => {
    setImages((prev) => [...prev, ...newImages]);
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const reorderImages = useCallback((startIndex: number, endIndex: number) => {
    setImages((prev) => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  }, []);

  const updateImage = useCallback((id: string, updates: Partial<UploadedImage>) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, ...updates } : img))
    );
  }, []);

  const clearImages = useCallback(() => {
    setImages([]);
  }, []);

  return {
    images,
    addImage,
    addImages,
    removeImage,
    reorderImages,
    updateImage,
    clearImages,
    setImages,
  };
}
