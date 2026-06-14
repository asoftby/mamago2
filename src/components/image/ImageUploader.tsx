"use client";

import { useRef, useState } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { useImageUpload, type UploadedImage } from "@/hooks/useImageUpload";
import {
  MAX_UPLOAD_SIZE_MB,
  UPLOAD_IMAGE_ACCEPT,
  getUploadHintText,
} from "@/lib/uploads/uploadConfig";

interface ImageUploaderProps {
  onUpload?: (image: UploadedImage) => void;
  onUploadBatch?: (images: UploadedImage[]) => void; // For multiple files at once
  onError?: (error: string) => void;
  accept?: string;
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  multiple?: boolean;
}

export function ImageUploader({
  onUpload,
  onUploadBatch,
  onError,
  accept = UPLOAD_IMAGE_ACCEPT,
  maxSizeMB = Math.min(1, MAX_UPLOAD_SIZE_MB),
  maxWidthOrHeight = 2048,
  quality = 0.8,
  disabled = false,
  className = "",
  children,
  multiple = true,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { uploadImages, uploading, progress, error } = useImageUpload({
    maxSizeMB,
    maxWidthOrHeight,
    quality,
    onUploadError: onError,
  });

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Convert FileList to array and upload all files
    const fileArray = Array.from(files);
    const results = await uploadImages(fileArray);

    // Use batch callback if available (prevents state race condition)
    if (onUploadBatch && results.length > 0) {
      onUploadBatch(results);
    } else if (onUpload) {
      results.forEach((image) => {
        onUpload(image);
      });
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    await handleFileSelect(files);
  };

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled || uploading}
      />

      {children ? (
        <div onClick={handleClick} className="cursor-pointer">
          {children}
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors
            ${isDragging ? "border-primary bg-primary/5" : "border-gray-300 hover:border-primary"}
            ${disabled || uploading ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          {uploading ? (
            <div className="space-y-3">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
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
                  Нажмите или перетащите изображение
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {maxSizeMB === MAX_UPLOAD_SIZE_MB
                    ? getUploadHintText()
                    : `Поддерживаются JPEG, JPG, PNG, WebP, GIF, AVIF, HEIC, HEIF. До ${maxSizeMB} МБ.`}
                </p>
              </div>
            </div>
          )}

          {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        </div>
      )}
    </div>
  );
}

interface ImagePreviewProps {
  image: UploadedImage;
  onRemove?: () => void;
  className?: string;
  showRemove?: boolean;
}

export function ImagePreview({
  image,
  onRemove,
  className = "",
  showRemove = true,
}: ImagePreviewProps) {
  return (
    <div className={`relative group ${className}`}>
      <img
        src={image.preview || image.url}
        alt=""
        className="w-full h-full object-cover rounded-lg"
      />

      {image.uploading && (
        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
        </div>
      )}

      {showRemove && onRemove && !image.uploading && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {image.error && (
        <div className="absolute inset-0 bg-red-50 rounded-lg flex items-center justify-center">
          <p className="text-xs text-red-600 px-2 text-center">{image.error}</p>
        </div>
      )}
    </div>
  );
}

interface ImageGalleryUploaderProps {
  images: UploadedImage[];
  onAdd: (image: UploadedImage) => void;
  onAddBatch?: (images: UploadedImage[]) => void; // For multiple files at once
  onRemove: (id: string) => void;
  onReorder?: (startIndex: number, endIndex: number) => void;
  maxImages?: number;
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
  disabled?: boolean;
}

export function ImageGalleryUploader({
  images,
  onAdd,
  onAddBatch,
  onRemove,
  onReorder,
  maxImages = 10,
  maxSizeMB = 1,
  maxWidthOrHeight = 2048,
  quality = 0.8,
  disabled = false,
}: ImageGalleryUploaderProps) {
  const canAddMore = images.length < maxImages;

  return (
    <div className="space-y-4">
      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <ImagePreview
              key={image.id}
              image={image}
              onRemove={() => onRemove(image.id)}
              className="aspect-square"
            />
          ))}
        </div>
      )}

      {/* Upload Button */}
      {canAddMore && (
        <ImageUploader
          onUpload={onAdd}
          onUploadBatch={onAddBatch}
          maxSizeMB={maxSizeMB}
          maxWidthOrHeight={maxWidthOrHeight}
          quality={quality}
          disabled={disabled}
        />
      )}

      {/* Info */}
      <p className="text-xs text-gray-500 text-center">
        {images.length} / {maxImages} изображений
      </p>
    </div>
  );
}
