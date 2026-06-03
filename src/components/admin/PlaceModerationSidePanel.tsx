"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { formatAgeKeys } from "@/lib/config/ages";
import { Textarea } from "@/components/ui/textarea";
import { getFormatLabel } from "@/lib/placeChips";
import { GoogleReviewsStatusBadge } from "@/components/admin/moderation/GoogleReviewsStatusBadge";

type PlaceDetail = {
  id: string;
  title: string;
  category: string;
  shortDesc: string;
  description: string | null;
  status: string;
  placeKind: string;
  logoImageId: string | null;
  lat: number | null;
  lng: number | null;
  formattedAddr: string | null;
  locationSource: string;
  customAddress: string | null;
  googlePlaceId?: string | null;
  googleRating?: number | null;
  googleUserRatingsTotal?: number | null;
  googleReviewsJson?: unknown;
  phone: string | null;
  website: string | null;
  instagramHandle: string | null;
  ageTags: string[];
  visitFormats: string[];
  activityTypes: string[];
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    email: string;
    phoneE164: string | null;
    createdAt: string;
  };
  city: {
    id: string;
    name: string;
  } | null;
  parentPlace: {
    id: string;
    title: string;
  } | null;
  images: Array<{
    id: string;
    kind: string;
    url: string;
    sortOrder: number;
  }>;
  moderationLogs?: Array<{
    id: string;
    action: string;
    message: string | null;
    createdAt: string;
    reviewedBy: {
      email: string;
    } | null;
  }>;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На проверке",
  NEEDS_CHANGES: "Требуется уточнение",
  PUBLISHED: "Опубликовано",
  REJECTED: "Отклонено",
};

const ACTION_LABELS: Record<string, string> = {
  SUBMIT: "Отправлено на модерацию",
  APPROVE: "Одобрено",
  NEEDS_CHANGES: "Требуется уточнение",
  REJECT: "Отклонено",
};

export function PlaceModerationSidePanel({
  placeId,
  onClose,
  onActionComplete,
}: {
  placeId: string;
  onClose: () => void;
  onActionComplete: (newStatus: string) => void;
}) {
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPlace();
  }, [placeId]);

  const fetchPlace = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/places/${placeId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка загрузки");
      }

      setPlace(data.place);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm("Опубликовать это место?")) {
      return;
    }

    setActionLoading(true);

    try {
      const res = await fetch(`/api/admin/places/${placeId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: message || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка одобрения");
      }

      alert("Место опубликовано");
      onActionComplete("PUBLISHED");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка одобрения");
    } finally {
      setActionLoading(false);
    }
  };

  const handleNeedsChanges = async () => {
    if (!message || message.trim().length === 0) {
      alert("Укажите, что требуется исправить");
      return;
    }

    if (!confirm("Запросить исправления?")) {
      return;
    }

    setActionLoading(true);

    try {
      const res = await fetch(`/api/admin/places/${placeId}/needs-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка запроса");
      }

      alert("Запрошены исправления");
      onActionComplete("NEEDS_CHANGES");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка запроса");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!message || message.trim().length === 0) {
      alert("Укажите причину отклонения");
      return;
    }

    if (!confirm("Отклонить это место?")) {
      return;
    }

    setActionLoading(true);

    try {
      const res = await fetch(`/api/admin/places/${placeId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка отклонения");
      }

      alert("Место отклонено");
      onActionComplete("REJECTED");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка отклонения");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Side Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-3xl bg-white shadow-xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Модерация места</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && <div className="text-center py-8">Загрузка...</div>}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
              {error}
            </div>
          )}

          {!loading && !error && !place && (
            <div className="text-center py-8">Место не найдено</div>
          )}

          {!loading && !error && place && (
            <div className="space-y-6">
              {/* Place Title & Status */}
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {place.title}
                </h3>
                <p className="text-gray-600 mt-1">
                  Статус: {STATUS_LABELS[place.status]}
                </p>
              </div>

              {/* Images */}
              {place.images.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-lg font-semibold mb-3">Фотографии</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {place.images.map((img) => (
                      <div key={img.id} className="relative aspect-square">
                        <img
                          src={img.url}
                          alt=""
                          className="w-full h-full object-cover rounded-md"
                        />
                        {img.kind === "LOGO" && (
                          <span className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded">
                            Лого
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Place Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-lg font-semibold mb-3">Информация</h4>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Категория
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {place.category}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Тип</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {place.placeKind}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm font-medium text-gray-500">
                      Краткое описание
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {place.shortDesc}
                    </dd>
                  </div>
                  {place.description && (
                    <div className="col-span-2">
                      <dt className="text-sm font-medium text-gray-500">
                        Полное описание
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                        {place.description}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Город</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {place.city?.name || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Адрес</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {place.formattedAddr || place.customAddress || "—"}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Статус Google Reviews</dt>
                    <dd className="mt-2">
                      <GoogleReviewsStatusBadge
                        googlePlaceId={place.googlePlaceId}
                        googleRating={place.googleRating}
                        googleUserRatingsTotal={place.googleUserRatingsTotal}
                        googleReviewsJson={place.googleReviewsJson}
                        compact
                      />
                    </dd>
                  </div>
                  {place.phone && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Телефон
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {place.phone}
                      </dd>
                    </div>
                  )}
                  {place.website && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Сайт
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        <a
                          href={place.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {place.website}
                        </a>
                      </dd>
                    </div>
                  )}
                  {place.instagramHandle && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Instagram
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        @{place.instagramHandle}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Tags */}
              {(place.ageTags.length > 0 ||
                place.visitFormats.length > 0 ||
                place.activityTypes.length > 0) && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-lg font-semibold mb-3">Теги</h4>
                  <div className="space-y-2">
                    {place.ageTags.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          Возраст:
                        </span>{" "}
                        <span className="text-sm text-gray-900">
                          {formatAgeKeys(place.ageTags)}
                        </span>
                      </div>
                    )}
                    {place.visitFormats.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          Форматы:
                        </span>{" "}
                        <span className="text-sm text-gray-900">
                          {place.visitFormats.map(getFormatLabel).join(", ")}
                        </span>
                      </div>
                    )}
                    {place.activityTypes.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          Типы активностей:
                        </span>{" "}
                        <span className="text-sm text-gray-900">
                          {place.activityTypes.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Owner Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-lg font-semibold mb-3">Владелец</h4>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {place.owner?.email || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Телефон
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {place.owner.phoneE164 || "—"}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Moderation Logs */}
              {(place.moderationLogs?.length ?? 0) > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-lg font-semibold mb-3">
                    История модерации
                  </h4>
                  <div className="space-y-3">
                    {place.moderationLogs?.map((log) => (
                      <div
                        key={log.id}
                        className="border-l-4 border-gray-300 pl-3"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">
                            {ACTION_LABELS[log.action]}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {new Date(log.createdAt).toLocaleString("ru-RU")}
                          </span>
                        </div>
                        {log.message && (
                          <p className="text-sm text-gray-700 mt-1">
                            {log.message}
                          </p>
                        )}
                        {log.reviewedBy && (
                          <p className="text-xs text-gray-500 mt-1">
                            Модератор: {log.reviewedBy.email}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Moderation Panel */}
              {place.status === "PENDING" && (
                <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                  <h4 className="text-lg font-semibold mb-3">Модерация</h4>
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="message"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Комментарий модератора
                        <span className="text-gray-500 text-xs ml-2">
                          (обязателен для уточнения и отклонения)
                        </span>
                      </label>
                      <Textarea
                        id="message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        placeholder="Укажите причину отклонения или что требуется исправить..."
                      />
                    </div>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={handleNeedsChanges}
                        disabled={actionLoading}
                        className="w-full px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {actionLoading
                          ? "Обработка..."
                          : "Требуется исправление"}
                      </button>
                      <button
                        onClick={handleApprove}
                        disabled={actionLoading}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {actionLoading ? "Обработка..." : "Опубликовать"}
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={actionLoading}
                        className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {actionLoading ? "Обработка..." : "Отклонить"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
