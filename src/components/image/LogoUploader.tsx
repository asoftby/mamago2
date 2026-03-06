"use client";

import { useState, useRef } from "react";
import { Upload, Camera } from "lucide-react";
import { useImageUpload, type UploadedImage } from "@/hooks/useImageUpload";

interface LogoUploaderProps {
  currentLogo?: string | null;
  onUpload: (image: UploadedImage) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

export function LogoUploader({
  currentLogo,
  onUpload,
  onError,
  disabled = false,
  size = "md",
}: LogoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentLogo || null);

  const { uploadImage, uploading, progress, error } = useImageUpload({
    maxSizeMB: 1,
    maxWidthOrHeight: 1024,
    quality: 0.85,
    onUploadComplete: (image) => {
      setPreview(image.preview);
      onUpload(image);
    },
    onUploadError: onError,
  });

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate aspect ratio (should be close to 1:1)
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(url);

      const aspectRatio = img.width / img.height;
      if (aspectRatio < 0.8 || aspectRatio > 1.2) {
        onError?.("Пожалуйста, выберите квадратное изображение (соотношение 1:1)");
        return;
      }

      await uploadImage(file);
    };

    img.src = url;
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const sizeClasses = {
    sm: "w-24 h-24",
    md: "w-32 h-32",
    lg: "w-40 h-40",
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled || uploading}
      />

      <div
        onClick={handleClick}
        className={`
          ${sizeClasses[size]}
          relative rounded-full overflow-hidden border-2 border-gray-300
          cursor-pointer hover:border-primary transition-colors
          ${disabled || uploading ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Logo"
              className="w-full h-full object-cover"
            />
            {!uploading && (
              <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-8 h-8 text-white" />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <Upload className="w-8 h-8 text-gray-400" />
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
              <p className="text-xs text-white mt-2">{progress}%</p>
            </div>
          </div>
        )}
      </div>

      <div className="text-center">
        <button
          onClick={handleClick}
          disabled={disabled || uploading}
          className="text-sm text-primary hover:underline disabled:opacity-50"
        >
          {preview ? "Изменить логотип" : "Загрузить логотип"}
        </button>
        <p className="text-xs text-gray-500 mt-1">
          Квадратное изображение, до 1MB
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-600 text-center">
          {error}
        </div>
      )}
    </div>
  );
}
