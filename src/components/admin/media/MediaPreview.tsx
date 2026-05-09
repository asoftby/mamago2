import { MediaAssetKind } from "@prisma/client";
import { Image as ImageIcon, Video, FileText } from "lucide-react";

interface MediaPreviewProps {
  kind: MediaAssetKind;
  publicUrl?: string | null;
  filename: string;
  /** Предпочтительно: поиск в /api/media/[filename] срабатывает по id без проблем с @ в имени и без обхода без cookie. */
  mediaId?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Превью для админки: обычный <img>, не next/image — иначе оптимизатор тянет API без cookies
 * и медиа без публичной linkage дают 404 в списке.
 */
export function MediaPreview({
  kind,
  publicUrl: _publicUrl,
  filename,
  mediaId,
  size = "sm",
}: MediaPreviewProps) {
  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-24 h-24",
    lg: "w-96 h-96",
  };

  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-12 h-12",
    lg: "w-32 h-32",
  };

  if (kind === "IMAGE") {
    const imageSrc = mediaId
      ? `/api/media/${mediaId}`
      : `/api/media/${encodeURIComponent(filename)}`;

    return (
      <div className={`${sizeClasses[size]} relative rounded-lg overflow-hidden bg-gray-100`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- нужен запрос из браузера с cookies (next/image optimizer без сессии). */}
        <img src={imageSrc} alt={filename} className="h-full w-full object-cover" />
      </div>
    );
  }

  // Placeholder for non-images
  const Icon = kind === "VIDEO" ? Video : FileText;

  return (
    <div className={`${sizeClasses[size]} flex items-center justify-center rounded-lg bg-gray-100`}>
      <Icon className={`${iconSizes[size]} text-gray-400`} />
    </div>
  );
}
