"use client";

import Image from "next/image";
import { useState } from "react";
import { isAppMediaUrl } from "@/lib/media/isAppMediaUrl";

type NetworkPlaceLogoProps = {
  name: string;
  logoUrl?: string | null;
};

/**
 * Если logoUrl отсутствует ИЛИ изображение не загрузилось — монограмма
 * (первая буква названия), чтобы карточка не зависела от наличия cover-фото.
 */
export function NetworkPlaceLogo({ name, logoUrl }: NetworkPlaceLogoProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(logoUrl) && !failed;
  const monogram = name.trim().charAt(0).toUpperCase();

  return (
    <span
      style={{
        display: "flex",
        height: 56,
        width: 56,
        flex: "none",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderRadius: 14,
        border: showImage ? "1px solid rgba(20,18,16,.10)" : "1px solid transparent",
        background: showImage ? "#FAF7F1" : "#F7E2D6",
      }}
      aria-hidden={!showImage}
    >
      {showImage ? (
        isAppMediaUrl(logoUrl as string) ? (
          <img
            src={logoUrl as string}
            alt={name}
            style={{ height: "100%", width: "100%", objectFit: "contain" }}
            onError={() => setFailed(true)}
          />
        ) : (
          <Image
            src={logoUrl as string}
            alt={name}
            width={56}
            height={56}
            style={{ height: "100%", width: "100%", objectFit: "contain" }}
            onError={() => setFailed(true)}
          />
        )
      ) : (
        <span
          style={{
            fontFamily: "var(--font-editorial)",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: 24,
            color: "#E86A3A",
          }}
        >
          {monogram}
        </span>
      )}
    </span>
  );
}
