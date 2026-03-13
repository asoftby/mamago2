import { MediaAssetKind } from "@prisma/client";
import { Image, Video, FileText } from "lucide-react";
import { resolveDisplayFileType } from "@/lib/media/resolveDisplayFileType";

interface MediaKindBadgeProps {
  kind: MediaAssetKind;
  extension?: string;
  mimeType?: string | null;
  originalName?: string | null;
  storageKey?: string | null;
}

export function MediaKindBadge({ kind, extension, mimeType, originalName, storageKey }: MediaKindBadgeProps) {
  const config = {
    IMAGE: {
      icon: Image,
      className: "bg-purple-100 text-purple-700",
    },
    VIDEO: {
      icon: Video,
      className: "bg-blue-100 text-blue-700",
    },
    DOCUMENT: {
      icon: FileText,
      className: "bg-gray-100 text-gray-700",
    },
  };

  const { icon: Icon, className } = config[kind];
  
  // Resolve display type
  const displayType = resolveDisplayFileType({
    mimeType,
    extension,
    originalName,
    storageKey,
  });

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${className}`}>
      <Icon className="w-3 h-3" />
      {displayType}
    </span>
  );
}
