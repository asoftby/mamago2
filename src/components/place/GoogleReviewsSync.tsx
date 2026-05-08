"use client";

import { useState } from "react";
import { RefreshCw, ExternalLink, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GoogleReviewsSyncProps {
  placeId: string;
  googlePlaceId?: string | null;
  googleRating?: number | null;
  googleUserRatingsTotal?: number | null;
  googleReviewsSyncedAt?: Date | null;
  googleMapsUri?: string | null;
  syncedReviewsCount?: number; // Количество отзывов в PlaceReview
}

export function GoogleReviewsSync({
  placeId,
  googlePlaceId,
  googleRating,
  googleUserRatingsTotal,
  googleReviewsSyncedAt,
  googleMapsUri,
  syncedReviewsCount = 0,
}: GoogleReviewsSyncProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSync = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log("[GoogleReviewsSync] Starting sync for place:", placeId);
      console.log("[GoogleReviewsSync] Google Place ID:", googlePlaceId);

      const response = await fetch(
        `/api/admin/places/${placeId}/sync-google-reviews`,
        {
          method: "POST",
        }
      );

      console.log("[GoogleReviewsSync] Response status:", response.status);

      const data = await response.json();
      console.log("[GoogleReviewsSync] Response data:", data);

      if (!response.ok) {
        // Специальное сообщение для случая когда нет отзывов
        if (data.error === "NO_REVIEWS_FOUND") {
          throw new Error("У этого места пока нет отзывов в Google Maps. Попробуйте позже или проверьте что Google Place ID правильный.");
        }
        throw new Error(data.message || data.error || "Failed to sync reviews");
      }

      setSuccess(
        `Отзывы успешно обновлены! Рейтинг: ${data.data.rating || "N/A"}, Отзывов: ${data.data.reviewsCount} (создано: ${data.data.reviewsCreated}, обновлено: ${data.data.reviewsUpdated})`
      );

      // Перезагрузить страницу через 2 секунды
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error("[GoogleReviewsSync] Error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred while syncing reviews.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "Никогда";
    return new Intl.DateTimeFormat("ru-RU", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const needsSync = () => {
    if (!googleReviewsSyncedAt) return true;
    const daysSinceSync = Math.floor(
      (Date.now() - new Date(googleReviewsSyncedAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return daysSinceSync >= 7;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <img
            src="https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_74x24dp.png"
            alt="Google"
            className="h-5"
          />
          Google Places данные
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Google Place ID */}
        <div>
          <label className="text-sm font-medium text-gray-700">
            Google Place ID
          </label>
          {googlePlaceId ? (
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm font-mono">
                {googlePlaceId}
              </code>
              {googleMapsUri && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={googleMapsUri}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <Alert className="mt-1">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Google Place ID не найден. Выберите место через Google Places
                Autocomplete при создании/редактировании.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Rating and Reviews */}
        {googlePlaceId && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Рейтинг Google
                </label>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {googleRating ? (
                    <>
                      ⭐ {googleRating.toFixed(1)}
                    </>
                  ) : (
                    <span className="text-gray-400 text-base">Нет данных</span>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Количество оценок
                </label>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {googleUserRatingsTotal ? (
                    googleUserRatingsTotal.toLocaleString("ru-RU")
                  ) : (
                    <span className="text-gray-400 text-base">Нет данных</span>
                  )}
                </div>
              </div>
            </div>

            {/* Synced Reviews Count */}
            {syncedReviewsCount > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Синхронизировано отзывов
                </label>
                <div className="mt-1 text-lg font-semibold text-blue-600">
                  {syncedReviewsCount} отзывов в базе данных
                </div>
              </div>
            )}

            {/* Last Sync */}
            <div>
              <label className="text-sm font-medium text-gray-700">
                Последняя синхронизация
              </label>
              <div className="mt-1 text-sm text-gray-600">
                {formatDate(googleReviewsSyncedAt)}
                {needsSync() && (
                  <span className="ml-2 text-orange-600 font-medium">
                    (рекомендуется обновить)
                  </span>
                )}
              </div>
            </div>

            {/* Sync Button */}
            <div className="pt-2">
              <Button
                onClick={handleSync}
                disabled={isLoading}
                className="w-full gap-2"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                />
                {isLoading ? "Обновление..." : "Обновить отзывы из Google"}
              </Button>
            </div>

            {/* Success Message */}
            {success && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {success}
                </AlertDescription>
              </Alert>
            )}

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Info */}
            <Alert>
              <AlertDescription className="text-sm">
                <strong>Google Places API</strong> возвращает максимум 5 отзывов. 
                Отзывы сохраняются в базу данных и обновляются автоматически раз в 7 дней 
                или вручную по кнопке. Отзывы отображаются на публичной странице места.
              </AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>
    </Card>
  );
}
