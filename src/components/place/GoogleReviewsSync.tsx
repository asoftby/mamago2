"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle, ExternalLink, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  classifyGoogleReviewsMatch,
  isGoogleReviewsEnabled,
  mergeGoogleReviewsMeta,
  readGoogleReviewsPayload,
} from "@/lib/place/googleReviewsMeta";

interface GoogleReviewsSyncProps {
  placeId?: string | null;
  placeTitle: string;
  placeAddress?: string | null;
  googlePlaceId?: string | null;
  googleRating?: number | null;
  googleUserRatingsTotal?: number | null;
  googleReviewsSyncedAt?: Date | null;
  googleMapsUri?: string | null;
  googleReviewsJson?: unknown;
  onChange?: (updates: Record<string, unknown>) => void;
}

export function GoogleReviewsSync({
  placeId,
  placeTitle,
  placeAddress,
  googlePlaceId,
  googleRating,
  googleUserRatingsTotal,
  googleReviewsSyncedAt,
  googleMapsUri,
  googleReviewsJson,
  onChange,
}: GoogleReviewsSyncProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const payload = useMemo(() => readGoogleReviewsPayload(googleReviewsJson), [googleReviewsJson]);
  const meta = payload?.meta;
  const enabled = isGoogleReviewsEnabled(googlePlaceId, googleReviewsJson);

  const applyMetaPatch = useCallback(
    (patch: Record<string, unknown>) => {
      onChange?.(patch);
    },
    [onChange],
  );

  const refreshPreview = useCallback(
    async (syncReviews: boolean) => {
      if (!googlePlaceId) return;
      setIsLoading(true);
      setError(null);
      setMessage(null);

      try {
        const previewRes = await fetch(
          `/api/business/places/google-preview?googlePlaceId=${encodeURIComponent(googlePlaceId)}`,
          { cache: "no-store" },
        );
        const previewData = (await previewRes.json().catch(() => ({}))) as {
          error?: string;
          displayName?: string;
          formattedAddress?: string;
          rating?: number | null;
          userRatingCount?: number | null;
          googleMapsUri?: string | null;
        };

        if (!previewRes.ok) {
          throw new Error(previewData.error || "Не удалось получить данные Google");
        }

        const classified = classifyGoogleReviewsMatch({
          placeTitle,
          placeAddress,
          googlePlaceId,
          googlePlaceName: previewData.displayName,
          googlePlaceAddress: previewData.formattedAddress,
        });

        const nextMeta = enabled
          ? { ...classified, enabled: true, matchStatus: "CONFIRMED" as const, disabledReason: null }
          : classified;

        applyMetaPatch({
          googleRating: previewData.rating ?? null,
          googleUserRatingsTotal: previewData.userRatingCount ?? null,
          googleMapsUri: previewData.googleMapsUri ?? null,
          googleReviewsJson: mergeGoogleReviewsMeta(googleReviewsJson, nextMeta),
        });

        if (syncReviews && placeId) {
          const syncRes = await fetch(`/api/admin/places/${placeId}/sync-google-reviews`, {
            method: "POST",
          });
          const syncData = (await syncRes.json().catch(() => ({}))) as {
            error?: string;
            message?: string;
            data?: {
              rating?: number | null;
              ratingsTotal?: number | null;
              syncedAt?: string;
            };
          };
          if (!syncRes.ok) {
            throw new Error(syncData.message || syncData.error || "Не удалось обновить отзывы Google");
          }

          applyMetaPatch({
            googleRating: syncData.data?.rating ?? previewData.rating ?? null,
            googleUserRatingsTotal:
              syncData.data?.ratingsTotal ?? previewData.userRatingCount ?? null,
          });
        }

        setMessage(syncReviews ? "Данные Google обновлены" : "Карточка Google проверена");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось обновить данные Google");
      } finally {
        setIsLoading(false);
      }
    },
    [
      googlePlaceId,
      placeTitle,
      placeAddress,
      enabled,
      applyMetaPatch,
      googleReviewsJson,
      placeId,
    ],
  );

  useEffect(() => {
    if (!googlePlaceId) return;
    if (
      meta?.googlePlaceName &&
      meta?.googlePlaceAddress &&
      googleRating !== undefined &&
      googleUserRatingsTotal !== undefined &&
      googleMapsUri !== undefined
    ) {
      return;
    }
    void refreshPreview(false);
  }, [
    googlePlaceId,
    meta?.googlePlaceName,
    meta?.googlePlaceAddress,
    googleRating,
    googleUserRatingsTotal,
    googleMapsUri,
    refreshPreview,
  ]);

  const disableReviews = () => {
    applyMetaPatch({
      googleReviewsJson: mergeGoogleReviewsMeta(googleReviewsJson, {
        enabled: false,
        matchStatus: "DISABLED",
        disabledReason: "manual_disable",
      }),
    });
    setMessage("Отзывы Google отключены для этого места");
    setError(null);
  };

  const enableReviews = () => {
    applyMetaPatch({
      googleReviewsJson: mergeGoogleReviewsMeta(googleReviewsJson, {
        enabled: true,
        matchStatus: "CONFIRMED",
        disabledReason: null,
        confirmedManually: true,
      }),
    });
    setMessage("Отзывы Google будут применяться к этому месту");
    setError(null);
  };

  const chooseAnotherCard = () => {
    applyMetaPatch({
      googlePlaceId: null,
      googleRating: null,
      googleUserRatingsTotal: null,
      googleMapsUri: null,
      googleReviewsJson: mergeGoogleReviewsMeta(null, {
        enabled: false,
        matchStatus: "DISABLED",
        disabledReason: "choose_another_card",
        googlePlaceName: null,
        googlePlaceAddress: null,
      }),
    });
    document.getElementById("place-location-search")?.scrollIntoView({ behavior: "smooth", block: "center" });
    setMessage("Текущая Google-карточка отвязана. Выберите другую выше.");
    setError(null);
  };

  if (!googlePlaceId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Отзывы Google</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Сначала выберите конкретное место через Google Places, чтобы проверить и привязать отзывы.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Отзывы Google</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-gray-900">
            {meta?.googlePlaceName || "Карточка Google"}
          </div>
          <div className="text-sm text-gray-600">
            {meta?.googlePlaceAddress || placeAddress || "Адрес не указан"}
          </div>
          {(googleRating || googleUserRatingsTotal) && (
            <div className="text-sm text-gray-700">
              Рейтинг: {googleRating ? googleRating.toFixed(1) : "—"} · Отзывов:{" "}
              {googleUserRatingsTotal ? googleUserRatingsTotal.toLocaleString("ru-RU") : "—"}
            </div>
          )}
        </div>

        {meta?.matchStatus === "ADDRESS_ONLY" && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Отзывы найдены по адресу. Проверьте, что это именно нужное место.
            </AlertDescription>
          </Alert>
        )}

        {meta?.matchStatus === "MISMATCH" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Название или адрес Google-карточки не похожи на данные места. Не применяйте отзывы без ручной проверки.
            </AlertDescription>
          </Alert>
        )}

        {meta?.matchStatus === "CONFIRMED" && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Google-карточка подтверждена для этого места.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={enableReviews} disabled={isLoading}>
            Использовать эти отзывы
          </Button>
          <Button type="button" variant="outline" onClick={disableReviews} disabled={isLoading}>
            Не применять к этому месту
          </Button>
          <Button type="button" variant="outline" onClick={chooseAnotherCard} disabled={isLoading}>
            Выбрать другую карточку
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refreshPreview(Boolean(placeId && enabled))}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Обновить данные Google
          </Button>
          {googleMapsUri ? (
            <Button asChild type="button" variant="ghost">
              <a href={googleMapsUri} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Открыть в Google
              </a>
            </Button>
          ) : null}
        </div>

        <div className="text-xs text-muted-foreground">
          Статус: {enabled ? "отзывы включены" : "отзывы не применяются"}
          {googleReviewsSyncedAt ? ` · синхронизация: ${new Date(googleReviewsSyncedAt).toLocaleString("ru-RU")}` : ""}
        </div>

        {message ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{message}</AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
