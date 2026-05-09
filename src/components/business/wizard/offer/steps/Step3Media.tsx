// Step 3: Media
// Inherits Event Wizard Step3Media pattern

import { X } from "lucide-react";
import { ImageUploader } from "@/components/image/ImageUploader";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { OfferFormData } from "../types";
import { isValidVideoUrl } from "../mappers";

interface Step3MediaProps {
  data: OfferFormData;
  onChange: (
    updates:
      | Partial<OfferFormData>
      | ((prev: OfferFormData) => Partial<OfferFormData>),
  ) => void;
  isEditable: boolean;
  wizardSessionId?: string;
}

export function Step3Media({ data, onChange, isEditable }: Step3MediaProps) {
  const removeCover = () => {
    if (!isEditable) return;
    onChange({ coverImage: null });
  };

  const removeGalleryUrl = (url: string) => {
    if (!isEditable) return;
    onChange((prev) => ({
      gallery: prev.gallery.filter((u) => u !== url),
    }));
  };

  const handleVideoUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ videoUrl: e.target.value });
  };

  const videoUrlError = data.videoUrl && !isValidVideoUrl(data.videoUrl) ? "Некорректная ссылка на видео" : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Медиа</h2>
        <p className="text-muted-foreground">
          Добавьте изображения для привлечения внимания к предложению
        </p>
      </div>

      {/* Cover Image */}
      <div className="space-y-2">
        <Label>
          Главное изображение <span className="text-red-500">*</span>
        </Label>
        {data.coverImage ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.coverImage} alt="" className="h-full w-full object-cover" />
              {isEditable ? (
                <button
                  type="button"
                  onClick={removeCover}
                  className="absolute right-2 top-2 rounded-full bg-red-600 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-700 group-hover:opacity-100"
                  aria-label="Удалить главное изображение"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <ImageUploader
          onUpload={(image) => onChange({ coverImage: image.url })}
          disabled={!isEditable}
          maxSizeMB={5}
          className="w-full"
          multiple={false}
        />
        <p className="text-xs text-muted-foreground">
          Основное изображение, которое будет показано в каталоге
        </p>
      </div>

      {/* Gallery */}
      <div className="space-y-2">
        <Label>Галерея (необязательно)</Label>
        {data.gallery.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {data.gallery.map((url) => (
              <div key={url} className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                {isEditable ? (
                  <button
                    type="button"
                    onClick={() => removeGalleryUrl(url)}
                    className="absolute right-2 top-2 rounded-full bg-red-600 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-700 group-hover:opacity-100"
                    aria-label="Удалить из галереи"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        <ImageUploader
          onUploadBatch={(images) =>
            onChange((prev) => ({
              gallery: [...prev.gallery, ...images.map((i) => i.url)],
            }))
          }
          disabled={!isEditable}
          maxSizeMB={3}
          className="w-full"
          multiple
        />
        <p className="text-xs text-muted-foreground">
          Дополнительные фотографии для детального показа предложения
        </p>
      </div>

      {/* Video URL */}
      <div className="space-y-2">
        <Label htmlFor="videoUrl">Видео (необязательно)</Label>
        <Input
          id="videoUrl"
          placeholder="Ссылка на YouTube, Shorts или Instagram Reels"
          value={data.videoUrl || ""}
          onChange={handleVideoUrlChange}
          disabled={!isEditable}
          className={videoUrlError ? "border-red-500" : ""}
        />
        {videoUrlError && (
          <p className="text-xs text-red-500">{videoUrlError}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Поддерживаются ссылки на YouTube, YouTube Shorts и Instagram Reels
        </p>
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Советы по фотографиям</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Используйте качественные и яркие изображения</li>
          <li>• Покажите процесс или результат предложения</li>
          <li>• Избегайте размытых или темных фотографий</li>
          <li>• Добавьте фото людей, которые пользуются услугой</li>
        </ul>
      </div>
    </div>
  );
}
