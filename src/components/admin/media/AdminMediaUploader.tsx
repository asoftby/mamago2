"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import { useImageUpload, type UploadedImage } from "@/hooks/useImageUpload";
import { useRouter } from "next/navigation";

interface AdminMediaUploaderProps {
  onUploadComplete?: () => void;
}

export function AdminMediaUploader({ onUploadComplete }: AdminMediaUploaderProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  const { uploadImage, uploading, progress } = useImageUpload({
    maxSizeMB: 10,
    maxWidthOrHeight: 4096,
    quality: 0.9,
    onUploadComplete: (image) => {
      setUploadedImages((prev) => [...prev, image]);
      // Refresh the page to show new media
      router.refresh();
      onUploadComplete?.();
    },
  });

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    // Upload multiple files
    for (let i = 0; i < files.length; i++) {
      await uploadImage(files[i]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFileSelect(e.dataTransfer.files);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 md:p-4">
      <h2 className="text-lg md:text-base font-semibold text-gray-900 mb-4">
        Загрузить медиафайлы
      </h2>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center
          transition-colors cursor-pointer
          ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400"}
          ${uploading ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading}
        />

        {uploading ? (
          <div className="space-y-3">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
            <p className="text-sm text-gray-600">Загрузка... {progress}%</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-center">
              <Upload className="w-12 h-12 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                Нажмите или перетащите изображения
              </p>
              <p className="text-xs text-gray-500 mt-1">
                JPEG, PNG, WebP, HEIC, HEIF до 10MB
              </p>
              <p className="text-xs text-gray-500">
                Поддерживается множественная загрузка
              </p>
            </div>
          </div>
        )}
      </div>

      {uploadedImages.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-green-600">
            Загружено файлов: {uploadedImages.length}
          </p>
        </div>
      )}
    </div>
  );
}
