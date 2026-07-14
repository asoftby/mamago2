/**
 * useWizardImageUpload Hook
 * Upload images for wizard sessions (creates TEMP MediaAssets)
 * 
 * Similar to useImageUpload but:
 * - Uses /api/upload/wizard endpoint
 * - Creates TEMP MediaAssets
 * - Requires wizardSessionId
 * - Media will be committed to ACTIVE when entity is published
 */

import { useState, useCallback } from "react";
import { compressImage, validateImageFile } from "@/lib/image/compression";
import { convertHeicFileToJpeg, isHeicFile } from "@/lib/uploads/heicConversion";
import { uploadMediaFile } from "@/lib/uploads/uploadClient";
import type { UploadedImage } from "./useImageUpload";

export interface UseWizardImageUploadOptions {
  wizardSessionId: string;
  draftEntityId?: string;
  draftEntityType?: "Activity" | "Place";
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  onUploadComplete?: (image: UploadedImage) => void;
  onUploadError?: (error: string) => void;
}

export function useWizardImageUpload(options: UseWizardImageUploadOptions) {
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const statusLabel = converting ? "Конвертируем…" : uploading ? "Загрузка…" : "";

  /**
   * Process and upload single image to wizard endpoint
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
        // so the rest of this function never has to special-case HEIC.
        let workingFile = file;
        if (isHeicFile(file)) {
          setConverting(true);
          try {
            workingFile = await convertHeicFileToJpeg(file);
          } finally {
            setConverting(false);
          }
        }

        const compressed = await compressImage(workingFile, {
          maxSizeMB: options.maxSizeMB,
          maxWidthOrHeight: options.maxWidthOrHeight,
          quality: options.quality,
        });
        const fileToUpload = compressed.file;
        const imageWidth = compressed.width;
        const imageHeight = compressed.height;
        const blurhash = compressed.blurhash;
        const preview = compressed.preview;

        setProgress(50);

        const uploadData = await uploadMediaFile(fileToUpload, {
          endpoint: "/api/upload/wizard",
          wizardSessionId: options.wizardSessionId,
          draftEntityId: options.draftEntityId,
          draftEntityType: options.draftEntityType,
        });

        console.log("📡 [WIZARD UPLOAD] Server response:", {
          mediaId: uploadData.id,
          url: uploadData.url,
        });
        console.log("✅ [WIZARD UPLOAD] Upload successful:", uploadData);

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

        options.onUploadComplete?.(uploadedImage);

        return uploadedImage;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Upload failed";
        setError(errorMessage);
        options.onUploadError?.(errorMessage);
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

  return {
    uploadImage,
    uploadImages,
    uploading,
    converting,
    statusLabel,
    progress,
    error,
    clearError: () => setError(null),
  };
}
