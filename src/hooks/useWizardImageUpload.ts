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
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

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

        // Check for HEIC/HEIF
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        const isHEIC = 
          file.type === "image/heic" || 
          file.type === "image/heif" ||
          fileExtension === "heic" ||
          fileExtension === "heif";
        
        console.log("🔍 [WIZARD UPLOAD] File details:", {
          name: file.name,
          type: file.type,
          extension: fileExtension,
          size: file.size,
          isHEIC,
          wizardSessionId: options.wizardSessionId,
        });
        
        let fileToUpload: File;
        let imageWidth = 0;
        let imageHeight = 0;
        let blurhash = "";
        let preview = "";

        if (isHEIC) {
          console.log("📸 [WIZARD UPLOAD] HEIC/HEIF detected, skipping client compression");
          fileToUpload = file;
        } else {
          console.log("🔄 [WIZARD UPLOAD] Compressing with browser-image-compression");
          const compressed = await compressImage(file, {
            maxSizeMB: options.maxSizeMB,
            maxWidthOrHeight: options.maxWidthOrHeight,
            quality: options.quality,
          });
          fileToUpload = compressed.file;
          imageWidth = compressed.width;
          imageHeight = compressed.height;
          blurhash = compressed.blurhash;
          preview = compressed.preview;
        }

        setProgress(50);

        // Upload to wizard endpoint
        const formData = new FormData();
        formData.append("file", fileToUpload);
        formData.append("wizardSessionId", options.wizardSessionId);
        if (options.draftEntityId) {
          formData.append("draftEntityId", options.draftEntityId);
        }
        if (options.draftEntityType) {
          formData.append("draftEntityType", options.draftEntityType);
        }

        const response = await fetch("/api/upload/wizard", {
          method: "POST",
          body: formData,
        });

        console.log("📡 [WIZARD UPLOAD] Server response:", {
          status: response.status,
          ok: response.ok,
        });

        if (!response.ok) {
          const contentType = response.headers.get("content-type");
          let errorMessage = `Upload failed: HTTP ${response.status}`;
          
          try {
            const responseText = await response.text();
            if (contentType?.includes("application/json") && responseText) {
              const errorData = JSON.parse(responseText);
              errorMessage = errorData.error || errorData.message || errorMessage;
            } else {
              errorMessage = responseText || errorMessage;
            }
          } catch (readError) {
            console.error("❌ [WIZARD UPLOAD] Failed to read response:", readError);
          }
          
          throw new Error(errorMessage);
        }

        const uploadData = await response.json();
        console.log("✅ [WIZARD UPLOAD] Upload successful:", {
          mediaId: uploadData.mediaId,
          status: uploadData.status,
          wizardSessionId: uploadData.wizardSessionId,
        });

        setProgress(100);

        const uploadedImage: UploadedImage = {
          id: uploadData.mediaId || `temp-${Date.now()}`,
          url: uploadData.url,
          width: uploadData.width || imageWidth,
          height: uploadData.height || imageHeight,
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
    progress,
    error,
    clearError: () => setError(null),
  };
}
