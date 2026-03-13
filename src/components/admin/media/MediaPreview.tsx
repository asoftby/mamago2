import { MediaAssetKind } from "@prisma/client";
import { Image as ImageIcon, Video, FileText } from "lucide-react";
import Image from "next/image";

interface MediaPreviewProps {
  kind: MediaAssetKind;
  publicUrl?: string | null;
  filename: string;
  size?: "sm" | "md" | "lg";
}

export function MediaPreview({ kind, publicUrl, filename, size = "sm" }: MediaPreviewProps) {
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
    // Use proxy route to serve with correct Content-Type
    const imageUrl = `/api/media/${filename}`;
    
    return (
      <div className={`${sizeClasses[size]} relative rounded-lg overflow-hidden bg-gray-100`}>
        <Image
          src={imageUrl}
          alt={filename}
          fill
          className="object-cover"
        />
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
