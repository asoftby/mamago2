// Step 5: Media and Publication (MVP)
// Cover image + gallery with uniqueness validation

"use client";

import { BYN_SYMBOL } from "@/lib/formatters/format-price";
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OfferFormDataMVP } from "../types.mvp";

interface Step5MediaMVPProps {
  data: OfferFormDataMVP;
  onChange: (updates: Partial<OfferFormDataMVP>) => void;
  isEditable: boolean;
  wizardSessionId?: string;
}

interface PlaceImage {
  url: string;
  isUsed: boolean;
  usedInOfferId?: string;
}

export function Step5MediaMVP({
  data,
  onChange,
  isEditable,
  wizardSessionId,
}: Step5MediaMVPProps) {
  const [placeImages, setPlaceImages] = useState<PlaceImage[]>([]);
  const [isLoadingPlaceImages, setIsLoadingPlaceImages] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  
  // Load place images with uniqueness check
  useEffect(() => {
    const loadPlaceImages = async () => {
      if (!data.placeId) return;
      
      setIsLoadingPlaceImages(true);
      try {
        // Get place images
        const placeResponse = await fetch(`/api/business/places/${data.placeId}`);
        if (!placeResponse.ok) return;
        
        const place = await placeResponse.json();
        const images: string[] = [];
        
        if (place.coverImage) images.push(place.coverImage);
        if (place.gallery) images.push(...place.gallery);
        
        // Check which images are already used in other offers
        const usedImagesResponse = await fetch(
          `/api/business/offers/check-images?placeId=${data.placeId}`
        );
        
        let usedImages: Record<string, string> = {};
        if (usedImagesResponse.ok) {
          const usedData = await usedImagesResponse.json();
          usedImages = usedData.usedImages || {};
        }
        
        // Map images with usage status
        const mappedImages: PlaceImage[] = images.map((url) => ({
          url,
          isUsed: url in usedImages,
          usedInOfferId: usedImages[url],
        }));
        
        setPlaceImages(mappedImages);
      } catch (error) {
        console.error("Failed to load place images:", error);
      } finally {
        setIsLoadingPlaceImages(false);
      }
    };
    
    loadPlaceImages();
  }, [data.placeId]);
  
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (wizardSessionId) {
        formData.append("wizardSessionId", wizardSessionId);
      }
      
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) throw new Error("Upload failed");
      
      const { url } = await response.json();
      onChange({ coverImage: url });
    } catch (error) {
      console.error("Cover upload failed:", error);
      alert("Ошибка загрузки изображения");
    } finally {
      setUploadingCover(false);
    }
  };
  
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setUploadingGallery(true);
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        if (wizardSessionId) {
          formData.append("wizardSessionId", wizardSessionId);
        }
        
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) throw new Error("Upload failed");
        
        const { url } = await response.json();
        return url;
      });
      
      const urls = await Promise.all(uploadPromises);
      onChange({ gallery: [...data.gallery, ...urls] });
    } catch (error) {
      console.error("Gallery upload failed:", error);
      alert("Ошибка загрузки изображений");
    } finally {
      setUploadingGallery(false);
    }
  };
  
  const handleSelectPlaceImage = (imageUrl: string, target: "cover" | "gallery") => {
    if (target === "cover") {
      onChange({ coverImage: imageUrl });
    } else {
      if (!data.gallery.includes(imageUrl)) {
        onChange({ gallery: [...data.gallery, imageUrl] });
      }
    }
  };
  
  const handleRemoveGalleryImage = (imageUrl: string) => {
    onChange({ gallery: data.gallery.filter((url) => url !== imageUrl) });
  };
  
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold mb-2">Фото и публикация</h2>
        <p className="text-muted-foreground">
          Добавьте изображения для вашего предложения
        </p>
      </div>
      
      {/* Important Notice */}
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex gap-2">
          <div className="text-yellow-600 mt-0.5">⚠️</div>
          <div className="text-sm text-yellow-900">
            <strong>Важно:</strong> Каждое предложение должно иметь уникальные фото.
            Одно и то же изображение нельзя использовать в нескольких предложениях
            одного места.
          </div>
        </div>
      </div>
      
      {/* Cover Image */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg space-y-4">
        <div>
          <Label className="flex items-center gap-1 text-base">
            Главное изображение
            <span className="text-red-500">*</span>
          </Label>
          <p className="text-sm text-muted-foreground mt-1">
            Это изображение будет показано в карточке предложения
          </p>
        </div>
        
        {data.coverImage ? (
          <div className="space-y-3">
            <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-green-500">
              <img
                src={data.coverImage}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange({ coverImage: null })}
              disabled={!isEditable}
            >
              Изменить изображение
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Upload new */}
            <div>
              <input
                type="file"
                id="cover-upload"
                accept="image/*"
                onChange={handleCoverUpload}
                disabled={!isEditable || uploadingCover}
                className="hidden"
              />
              <Button
                type="button"
                variant="default"
                onClick={() => document.getElementById("cover-upload")?.click()}
                disabled={!isEditable || uploadingCover}
              >
                {uploadingCover ? "Загрузка..." : "📤 Загрузить новое фото"}
              </Button>
            </div>
            
            {/* Select from place */}
            {placeImages.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Или выберите из фото места:</p>
                <div className="grid grid-cols-3 gap-3">
                  {placeImages.map((image) => (
                    <button
                      key={image.url}
                      type="button"
                      onClick={() => !image.isUsed && handleSelectPlaceImage(image.url, "cover")}
                      disabled={!isEditable || image.isUsed}
                      className={cn(
                        "relative aspect-video rounded-lg overflow-hidden border-2 transition-all",
                        image.isUsed
                          ? "opacity-50 cursor-not-allowed border-gray-300"
                          : "hover:border-primary border-gray-200"
                      )}
                    >
                      <img
                        src={image.url}
                        alt="Place"
                        className="w-full h-full object-cover"
                      />
                      {image.isUsed && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <p className="text-white text-xs text-center px-2">
                            Уже используется
                          </p>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {isLoadingPlaceImages && (
              <p className="text-sm text-muted-foreground">Загрузка фото места...</p>
            )}
          </div>
        )}
      </div>
      
      {/* Gallery */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg space-y-4">
        <div>
          <Label className="flex items-center gap-1 text-base">
            Галерея
            <span className="text-red-500">*</span>
          </Label>
          <p className="text-sm text-muted-foreground mt-1">
            Минимум 1 изображение. Добавьте больше фото, чтобы показать детали
          </p>
        </div>
        
        {/* Current gallery */}
        {data.gallery.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {data.gallery.map((url, index) => (
              <div
                key={index}
                className="relative aspect-video rounded-lg overflow-hidden border-2 border-gray-200"
              >
                <img
                  src={url}
                  alt={`Gallery ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => handleRemoveGalleryImage(url)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Upload more */}
        <div className="space-y-4">
          <div>
            <input
              type="file"
              id="gallery-upload"
              accept="image/*"
              multiple
              onChange={handleGalleryUpload}
              disabled={!isEditable || uploadingGallery}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById("gallery-upload")?.click()}
              disabled={!isEditable || uploadingGallery}
            >
              {uploadingGallery ? "Загрузка..." : "📤 Добавить фото"}
            </Button>
          </div>
          
          {/* Select from place */}
          {placeImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Или выберите из фото места:</p>
              <div className="grid grid-cols-3 gap-3">
                {placeImages.map((image) => {
                  const alreadyInGallery = data.gallery.includes(image.url);
                  const isDisabled = image.isUsed || alreadyInGallery;
                  
                  return (
                    <button
                      key={image.url}
                      type="button"
                      onClick={() => !isDisabled && handleSelectPlaceImage(image.url, "gallery")}
                      disabled={!isEditable || isDisabled}
                      className={cn(
                        "relative aspect-video rounded-lg overflow-hidden border-2 transition-all",
                        isDisabled
                          ? "opacity-50 cursor-not-allowed border-gray-300"
                          : "hover:border-primary border-gray-200"
                      )}
                    >
                      <img
                        src={image.url}
                        alt="Place"
                        className="w-full h-full object-cover"
                      />
                      {image.isUsed && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <p className="text-white text-xs text-center px-2">
                            Уже используется
                          </p>
                        </div>
                      )}
                      {alreadyInGallery && (
                        <div className="absolute inset-0 bg-green-500/60 flex items-center justify-center">
                          <p className="text-white text-xs text-center px-2">
                            ✓ Добавлено
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Preview Card */}
      {data.coverImage && data.title && (
        <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
          <h3 className="font-semibold">Предпросмотр карточки:</h3>
          <div className="bg-white rounded-lg overflow-hidden shadow-sm max-w-sm">
            <div className="aspect-video">
              <img
                src={data.coverImage}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-4 space-y-2">
              <h4 className="font-semibold text-lg">{data.title}</h4>
              {data.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {data.description}
                </p>
              )}
              {data.priceFrom && (
                <p className="text-lg font-bold text-primary">
                  от {data.priceFrom} {BYN_SYMBOL}
                  {data.priceText && (
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      {data.priceText}
                    </span>
                  )}
                </p>
              )}
              {data.ageMinMonths && data.ageMaxMonths && (
                <p className="text-sm text-muted-foreground">
                  Возраст: {monthsToYears(data.ageMinMonths)} - {monthsToYears(data.ageMaxMonths)}
                </p>
              )}
              {data.ctaType && (
                <Button className="w-full mt-2">
                  {getCTALabel(data.ctaType)}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function monthsToYears(months: number): string {
  if (months < 12) return `${months} мес`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "год" : years <= 4 ? "года" : "лет"}`;
}

function getCTALabel(ctaType: string): string {
  const labels: Record<string, string> = {
    записаться: "Записаться",
    забронировать: "Забронировать",
    купить_билет: "Купить билет",
    отправить_заявку: "Отправить заявку",
    перейти_на_сайт: "Перейти на сайт",
  };
  return labels[ctaType] || ctaType;
}
