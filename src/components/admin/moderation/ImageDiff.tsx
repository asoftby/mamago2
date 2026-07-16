/**
 * Component to display image changes
 */

import { useState } from "react";
import Image from "next/image";
import { ImageChange } from "@/lib/moderation/diffUtils";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface ImageDiffProps {
  changes: {
    added: ImageChange[];
    removed: ImageChange[];
    unchanged: ImageChange[];
  };
}

export function ImageDiff({ changes }: ImageDiffProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const hasChanges = changes.added.length > 0 || changes.removed.length > 0;

  if (!hasChanges && changes.unchanged.length === 0) {
    return null;
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-white">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Фотографии</h3>

      {!hasChanges && (
        <p className="text-sm text-gray-600">Фотографии не изменились</p>
      )}

      {/* Added Photos */}
      {changes.added.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-semibold text-gray-900">Добавлено</h4>
            <Badge className="bg-green-100 text-green-800 border-green-200">
              {changes.added.length}
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {changes.added.map((image, index) => (
              <div
                key={image.id}
                className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 border-green-300 cursor-pointer hover:border-green-400 transition-colors"
                onClick={() => setSelectedImage(image.url)}
              >
                <Image
                  src={image.url}
                  alt={`Фото ${index + 1}`}
                  fill
                  className="object-cover"
                  // Same-origin gated media (see PlaceModerationView) — Next's
                  // optimizer proxy can't carry the session cookie this route
                  // needs, so it must be skipped for not-yet-published Places.
                  unoptimized
                />
                {/* Photo number */}
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-xs font-medium rounded">
                  Фото {index + 1}
                </div>
                {/* NEW badge */}
                <div className="absolute top-2 right-2">
                  <Badge className="bg-green-600 text-white text-xs">NEW</Badge>
                </div>
                {/* Primary photo indicator */}
                {index === 0 && (
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-primary text-white text-xs rounded">
                    Главное
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Removed Photos */}
      {changes.removed.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-semibold text-gray-900">Удалено</h4>
            <Badge className="bg-red-100 text-red-800 border-red-200">
              {changes.removed.length}
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {changes.removed.map((image, index) => (
              <div
                key={image.id}
                className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 border-red-300 cursor-pointer hover:border-red-400 transition-colors"
                onClick={() => setSelectedImage(image.url)}
              >
                <Image
                  src={image.url}
                  alt={`Фото ${index + 1}`}
                  fill
                  className="object-cover opacity-60"
                  unoptimized
                />
                <div className="absolute inset-0 bg-red-500 bg-opacity-20" />
                {/* Photo number */}
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-xs font-medium rounded">
                  Фото {index + 1}
                </div>
                {/* REMOVED badge */}
                <div className="absolute top-2 right-2">
                  <Badge className="bg-red-600 text-white text-xs">REMOVED</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unchanged Photos (collapsed by default if there are changes) */}
      {changes.unchanged.length > 0 && !hasChanges && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Текущие фотографии ({changes.unchanged.length})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {changes.unchanged.map((image, index) => (
              <div
                key={image.id}
                className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200 cursor-pointer hover:border-gray-300 transition-colors"
                onClick={() => setSelectedImage(image.url)}
              >
                <Image
                  src={image.url}
                  alt={`Фото ${index + 1}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
                {/* Photo number */}
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-xs font-medium rounded">
                  Фото {index + 1}
                </div>
                {/* Primary photo indicator */}
                {index === 0 && (
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-primary text-white text-xs rounded">
                    Главное
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setSelectedImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full">
            <Image
              src={selectedImage}
              alt=""
              fill
              className="object-contain"
              unoptimized
            />
          </div>
        </div>
      )}
    </div>
  );
}
