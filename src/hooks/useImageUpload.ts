/**
 * useImageUpload Hook
 * Unified hook for image compression and upload
 * Used for Place logo/gallery and Activity cover/gallery
 */

import { useState, useCallback } from "react";
import { compressImage, validateImageFile, type CompressedImage } from "@/lib/image/compression";

export interface UploadedImage {
  id: string; // Temporary ID for UI (will be replaced with DB ID)
  url: string;
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
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

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

        // Skip client-side compression for HEIC/HEIF (not supported by browser-image-compression)
        // Server will handle these formats with sharp
        // Check both MIME type and file extension (macOS sometimes sends wrong MIME type)
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        const isHEIC = 
          file.type === "image/heic" || 
          file.type === "image/heif" ||
          fileExtension === "heic" ||
          fileExtension === "heif";
        
        console.log("🔍 [CLIENT] File details:", {
          name: file.name,
          type: file.type,
          extension: fileExtension,
          size: file.size,
          isHEIC,
        });
        
        let fileToUpload: File;
        let imageWidth = 0;
        let imageHeight = 0;
        let blurhash = "";
        let preview = "";

        if (isHEIC) {
          console.log("📸 [CLIENT] HEIC/HEIF detected, skipping client compression");
          fileToUpload = file;
          // Server will provide dimensions after processing
        } else {
          console.log("🔄 [CLIENT] Compressing with browser-image-compression");
          // Compress image for other formats
          const compressed = await compressImage(file, {
            maxSizeMB: options?.maxSizeMB,
            maxWidthOrHeight: options?.maxWidthOrHeight,
            quality: options?.quality,
          });
          fileToUpload = compressed.file;
          imageWidth = compressed.width;
          imageHeight = compressed.height;
          blurhash = compressed.blurhash;
          preview = compressed.preview;
        }

        setProgress(50);

        // Upload to server
        const formData = new FormData();
        formData.append("file", fileToUpload);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const responseStatus = response.status;
        const responseStatusText = response.statusText;
        const responseOk = response.ok;
        const responseHeaders = Object.fromEntries(response.headers.entries());
        
        console.log("📡 [CLIENT] Server response:", {
          status: responseStatus,
          statusText: responseStatusText,
          ok: responseOk,
          headers: responseHeaders,
        });

        if (!responseOk) {
          const contentType = response.headers.get("content-type");
          let errorMessage = `Upload failed: HTTP ${responseStatus} ${responseStatusText}`;
          
          try {
            // Read response body once
            const responseText = await response.text();
            console.log("📄 [CLIENT] Raw response body:", responseText);
            
            if (contentType?.includes("application/json") && responseText) {
              try {
                const errorData = JSON.parse(responseText);
                console.log("✅ [CLIENT] Parsed JSON error:", errorData);
                errorMessage = errorData.error || errorData.message || errorMessage;
              } catch (jsonError) {
                console.error("❌ [CLIENT] JSON parse failed, using raw text");
                errorMessage = responseText || errorMessage;
              }
            } else {
              errorMessage = responseText || errorMessage;
            }
          } catch (readError) {
            console.error("❌ [CLIENT] Failed to read response:", readError);
          }
          
          console.error("❌ [CLIENT] Upload failed with message:", errorMessage);
          
          throw new Error(errorMessage);
        }

        const uploadData = await response.json();
        console.log("✅ [CLIENT] Upload successful:", uploadData);

        setProgress(100);

        const uploadedImage: UploadedImage = {
          id: `temp-${Date.now()}`, // Temporary ID
          url: uploadData.url,
          width: uploadData.width || imageWidth,
          height: uploadData.height || imageHeight,
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
