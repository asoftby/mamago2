import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type MediaCoverProps = {
  imageUrl?: string | null;
  alt?: string;
  ratio?: string;
  className?: string;
  children?: React.ReactNode;
};

export function MediaCover({ imageUrl, alt, ratio = "4/5", className, children }: MediaCoverProps) {
  // Inline aspect-ratio: Tailwind arbitrary `aspect-[2/3]` часто не попадает в CSS (слеш в значении),
  // из-за чего контейнер получает высоту 0 и «нет фото».
  const aspectStyle =
    ratio && /^\d+\s*\/\s*\d+$/.test(ratio.trim())
      ? ({ aspectRatio: ratio.replace(/\s/g, "") } as React.CSSProperties)
      : undefined;

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-[var(--radius-card)] shadow-card", className)}
      style={aspectStyle}
    >
      {imageUrl ? (
        imageUrl.startsWith('http') ? (
          <img
            src={imageUrl}
            alt={alt || ""}
            className="absolute right-0 bottom-0 h-full w-full object-cover"
          />
        ) : (
          <Image
            src={imageUrl}
            alt={alt || ""}
            fill
            sizes="(max-width: 768px) 50vw, 600px"
            className="object-cover"
          />
        )
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#F5F5F5] via-[#ECECEC] to-[#E5E5E5]" />
      )}
      {children}
    </div>
  );
}
