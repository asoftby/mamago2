// Step 3: Media
// Inherits Event Wizard Step3Media pattern

import { ImageUploader } from "@/components/image/ImageUploader";
import { Label } from "@/components/ui/label";
import type { OfferFormData } from "../types";

interface Step3MediaProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
  wizardSessionId?: string;
}

export function Step3Media({ data, onChange, isEditable, wizardSessionId }: Step3MediaProps) {
  const handleCoverImageChange = (imageId: string | null) => {
    onChange({ coverImage: imageId });
  };

  const handleGalleryChange = (imageIds: string[]) => {
    onChange({ gallery: imageIds });
  };

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
        <ImageUploader
          value={data.coverImage}
          onChange={handleCoverImageChange}
          disabled={!isEditable}
          wizardSessionId={wizardSessionId}
          aspectRatio="16:9"
          maxSizeMB={5}
        />
        <p className="text-xs text-muted-foreground">
          Основное изображение, которое будет показано в каталоге
        </p>
      </div>

      {/* Gallery */}
      <div className="space-y-2">
        <Label>Галерея (необязательно)</Label>
        <ImageUploader
          value={data.gallery}
          onChange={handleGalleryChange}
          disabled={!isEditable}
          wizardSessionId={wizardSessionId}
          multiple
          maxFiles={8}
          aspectRatio="4:3"
          maxSizeMB={3}
        />
        <p className="text-xs text-muted-foreground">
          Дополнительные фотографии для детального показа предложения
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