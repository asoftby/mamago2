"use client";

import { useEffect, useState } from "react";
import { Star, Check, X, Trash2, ExternalLink, MessageSquare, Edit, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAbsolutePlacePublicUrl } from "@/lib/placePublicUrl";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Review {
  id: string;
  placeId: string;
  source: "MAMAGO" | "GOOGLE";
  authorName: string;
  rating: number;
  text: string | null;
  status: "PENDING" | "PUBLISHED" | "HIDDEN";
  createdAt: string;
  ownerReplyText: string | null;
  ownerReplyAuthorName: string | null;
  ownerReplyCreatedAt: string | null;
  place: {
    id: string;
    title: string;
    slug: string | null;
  };
}

type FilterStatus = "all" | "pending" | "published" | "hidden";
type FilterSource = "all" | "mamago" | "google";
type FilterReply = "all" | "with-reply" | "without-reply";

/** SelectTrigger по умолчанию w-fit (~5.5rem); фильтры — в 2.5 раза шире, одинаково. */
const FILTER_SELECT_WIDTH_CLASS = "w-[13.75rem]";

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterSource, setFilterSource] = useState<FilterSource>("all");
  const [filterReply, setFilterReply] = useState<FilterReply>("all");

  // Reply modal state
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [replyReview, setReplyReview] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);

  useEffect(() => {
    loadReviews();
  }, [filterStatus, filterSource, filterReply]);

  async function loadReviews() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterSource !== "all") params.set("source", filterSource);
      if (filterReply !== "all") params.set("hasReply", filterReply === "with-reply" ? "true" : "false");

      const response = await fetch(`/api/admin/moderation/reviews?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setReviews(data.data.reviews);
      }
    } catch (error) {
      console.error("Failed to load reviews:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish(reviewId: string) {
    setActionLoading(reviewId);
    try {
      const response = await fetch(`/api/admin/moderation/reviews/place-reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      });

      if (response.ok) {
        loadReviews();
      } else {
        alert("Ошибка при публикации отзыва");
      }
    } catch (error) {
      console.error("Failed to publish:", error);
      alert("Ошибка при публикации отзыва");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleHide(reviewId: string) {
    setActionLoading(reviewId);
    try {
      const response = await fetch(`/api/admin/moderation/reviews/place-reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "HIDDEN" }),
      });

      if (response.ok) {
        loadReviews();
      } else {
        alert("Ошибка при скрытии отзыва");
      }
    } catch (error) {
      console.error("Failed to hide:", error);
      alert("Ошибка при скрытии отзыва");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(reviewId: string) {
    if (!confirm("Удалить отзыв? Это действие нельзя отменить.")) {
      return;
    }

    setActionLoading(reviewId);
    try {
      const response = await fetch(`/api/admin/moderation/reviews/place-reviews/${reviewId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        loadReviews();
      } else {
        const error = await response.json();
        alert(error.error || "Ошибка при удалении отзыва");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("Ошибка при удалении отзыва");
    } finally {
      setActionLoading(null);
    }
  }

  function openReplyModal(review: Review) {
    setReplyReview(review);
    setReplyText(review.ownerReplyText || "");
    setReplyModalOpen(true);
  }

  async function handleSaveReply() {
    if (!replyReview || !replyText.trim()) return;

    setReplyLoading(true);
    try {
      const response = await fetch(
        `/api/admin/moderation/reviews/place-reviews/${replyReview.id}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: replyText }),
        }
      );

      if (response.ok) {
        setReplyModalOpen(false);
        setReplyReview(null);
        setReplyText("");
        loadReviews();
      } else {
        alert("Ошибка при сохранении ответа");
      }
    } catch (error) {
      console.error("Failed to save reply:", error);
      alert("Ошибка при сохранении ответа");
    } finally {
      setReplyLoading(false);
    }
  }

  async function handleDeleteReply(reviewId: string) {
    if (!confirm("Удалить ответ автора?")) return;

    setActionLoading(reviewId);
    try {
      const response = await fetch(
        `/api/admin/moderation/reviews/place-reviews/${reviewId}/reply`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        loadReviews();
      } else {
        alert("Ошибка при удалении ответа");
      }
    } catch (error) {
      console.error("Failed to delete reply:", error);
      alert("Ошибка при удалении ответа");
    } finally {
      setActionLoading(null);
    }
  }

  const filteredReviews = reviews;

  const pendingCount = reviews.filter((r) => r.status === "PENDING").length;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Отзывы</h1>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {pendingCount} на модерации
            </Badge>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className={FILTER_SELECT_WIDTH_CLASS}>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Статус
              </label>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="pending">На модерации</SelectItem>
                  <SelectItem value="published">Опубликованные</SelectItem>
                  <SelectItem value="hidden">Скрытые</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={FILTER_SELECT_WIDTH_CLASS}>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Источник
              </label>
              <Select value={filterSource} onValueChange={(v) => setFilterSource(v as FilterSource)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="mamago">mamaGo</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={FILTER_SELECT_WIDTH_CLASS}>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Ответ автора
              </label>
              <Select value={filterReply} onValueChange={(v) => setFilterReply(v as FilterReply)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="with-reply">С ответом</SelectItem>
                  <SelectItem value="without-reply">Без ответа</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">Загрузка...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredReviews.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-600">Отзывов не найдено</p>
          </div>
        )}

        {/* Reviews List */}
        {!loading && filteredReviews.length > 0 && (
          <div className="space-y-4">
            {filteredReviews.map((review) => (
              <div
                key={review.id}
                className="bg-white border border-gray-200 rounded-lg p-6 space-y-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{review.place.title}</h3>
                      <Link
                        href={getAbsolutePlacePublicUrl({
                          slug: review.place.slug,
                          id: review.place.id,
                        }) ?? "#"}
                        target="_blank"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      <Badge variant={review.source === "MAMAGO" ? "default" : "secondary"}>
                        {review.source === "MAMAGO" ? "mamaGo" : "Google"}
                      </Badge>
                      <Badge
                        variant={
                          review.status === "PUBLISHED"
                            ? "default"
                            : review.status === "PENDING"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {review.status === "PUBLISHED"
                          ? "Опубликован"
                          : review.status === "PENDING"
                          ? "На модерации"
                          : "Скрыт"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">Автор: {review.authorName}</p>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${
                          star <= review.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "fill-gray-200 text-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Review Text */}
                {review.text && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-line">{review.text}</p>
                  </div>
                )}

                {/* Owner Reply */}
                {review.ownerReplyText && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 ml-8">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-blue-900">Ответ места</p>
                      <p className="text-xs text-blue-700">
                        {review.ownerReplyCreatedAt &&
                          new Date(review.ownerReplyCreatedAt).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                    <p className="text-gray-700 whitespace-pre-line">{review.ownerReplyText}</p>
                  </div>
                )}

                {/* Meta */}
                <div className="text-sm text-gray-500">
                  {new Date(review.createdAt).toLocaleString("ru-RU")}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                  {/* mamaGo actions */}
                  {review.source === "MAMAGO" && (
                    <>
                      {review.status === "PENDING" && (
                        <Button
                          onClick={() => handlePublish(review.id)}
                          disabled={actionLoading === review.id}
                          className="bg-green-600 hover:bg-green-700"
                          size="sm"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Опубликовать
                        </Button>
                      )}

                      {review.status !== "HIDDEN" && (
                        <Button
                          onClick={() => handleHide(review.id)}
                          disabled={actionLoading === review.id}
                          variant="outline"
                          size="sm"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Скрыть
                        </Button>
                      )}

                      {review.status === "HIDDEN" && (
                        <Button
                          onClick={() => handlePublish(review.id)}
                          disabled={actionLoading === review.id}
                          variant="outline"
                          size="sm"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Вернуть к публикации
                        </Button>
                      )}

                      <Button
                        onClick={() => handleDelete(review.id)}
                        disabled={actionLoading === review.id}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Удалить
                      </Button>

                      {!review.ownerReplyText ? (
                        <Button
                          onClick={() => openReplyModal(review)}
                          disabled={actionLoading === review.id}
                          variant="outline"
                          size="sm"
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Ответить
                        </Button>
                      ) : (
                        <>
                          <Button
                            onClick={() => openReplyModal(review)}
                            disabled={actionLoading === review.id}
                            variant="outline"
                            size="sm"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Редактировать ответ
                          </Button>
                          <Button
                            onClick={() => handleDeleteReply(review.id)}
                            disabled={actionLoading === review.id}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash className="w-4 h-4 mr-2" />
                            Удалить ответ
                          </Button>
                        </>
                      )}
                    </>
                  )}

                  {/* Google actions */}
                  {review.source === "GOOGLE" && (
                    <>
                      {review.status !== "HIDDEN" && (
                        <Button
                          onClick={() => handleHide(review.id)}
                          disabled={actionLoading === review.id}
                          variant="outline"
                          size="sm"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Скрыть
                        </Button>
                      )}

                      {review.status === "HIDDEN" && (
                        <Button
                          onClick={() => handlePublish(review.id)}
                          disabled={actionLoading === review.id}
                          variant="outline"
                          size="sm"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Вернуть к публикации
                        </Button>
                      )}

                      <Link
                        href={`/admin/content/places/${review.placeId}`}
                        target="_blank"
                      >
                        <Button variant="outline" size="sm">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Открыть место
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reply Modal */}
      {replyModalOpen && replyReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <h2 className="text-2xl font-bold">Ответить на отзыв</h2>

              {/* Review Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{replyReview.authorName}</p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= replyReview.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "fill-gray-200 text-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {replyReview.text && (
                  <p className="text-gray-700 text-sm whitespace-pre-line">
                    {replyReview.text}
                  </p>
                )}
              </div>

              {/* Reply Textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ответ автора
                </label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 min-h-[150px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Введите ответ от имени места..."
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 justify-end">
                <Button
                  onClick={() => {
                    setReplyModalOpen(false);
                    setReplyReview(null);
                    setReplyText("");
                  }}
                  variant="outline"
                  disabled={replyLoading}
                >
                  Отмена
                </Button>
                <Button
                  onClick={handleSaveReply}
                  disabled={replyLoading || !replyText.trim()}
                >
                  {replyLoading ? "Сохранение..." : "Сохранить ответ"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
