"use client";

import { Badge } from "@/components/ui/badge";
import { readGoogleReviewsPayload, type GoogleReviewsMatchStatus } from "@/lib/place/googleReviewsMeta";

interface GoogleReviewsStatusBadgeProps {
  googlePlaceId?: string | null;
  googleReviewsJson?: unknown;
  googleRating?: number | null;
  googleUserRatingsTotal?: number | null;
  compact?: boolean;
}

const STATUS_UI: Record<
  GoogleReviewsMatchStatus,
  { label: string; className: string; helper: string }
> = {
  CONFIRMED: {
    label: "Google: подтверждено",
    className: "bg-green-100 text-green-800 border-green-200",
    helper: "Отзывы Google подтверждены и могут использоваться на публичной странице.",
  },
  ADDRESS_ONLY: {
    label: "Google: только адрес",
    className: "bg-amber-100 text-amber-800 border-amber-200",
    helper: "Совпадение найдено только по адресу. Нужна ручная проверка редактора.",
  },
  MISMATCH: {
    label: "Google: mismatch",
    className: "bg-red-100 text-red-800 border-red-200",
    helper: "Название или адрес Google-карточки не похожи на данные места.",
  },
  DISABLED: {
    label: "Google: отключено",
    className: "bg-gray-100 text-gray-700 border-gray-200",
    helper: "Отзывы Google отключены и не влияют на публичную страницу.",
  },
};

export function GoogleReviewsStatusBadge({
  googlePlaceId,
  googleReviewsJson,
  googleRating,
  googleUserRatingsTotal,
  compact = false,
}: GoogleReviewsStatusBadgeProps) {
  const payload = readGoogleReviewsPayload(googleReviewsJson);
  const meta = payload?.meta;

  if (!googlePlaceId && !meta) {
    return null;
  }

  const status = meta?.matchStatus ?? "DISABLED";
  const config = STATUS_UI[status];

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={config.className}>
          {config.label}
        </Badge>
        {googlePlaceId ? (
          <span className="text-xs text-gray-500">Place ID привязан</span>
        ) : (
          <span className="text-xs text-gray-500">Place ID не указан</span>
        )}
        {(googleRating || googleUserRatingsTotal) && (
          <span className="text-xs text-gray-500">
            {googleRating ? `★ ${googleRating.toFixed(1)}` : "★ —"} ·{" "}
            {googleUserRatingsTotal ? `${googleUserRatingsTotal.toLocaleString("ru-RU")} оценок` : "нет оценок"}
          </span>
        )}
      </div>
      {!compact ? <p className="text-xs text-gray-600">{config.helper}</p> : null}
    </div>
  );
}
