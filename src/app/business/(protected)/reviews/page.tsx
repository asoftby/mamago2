"use client";

import { useEffect, useState } from "react";
import { Star, MessageSquare, Edit, Trash, ExternalLink } from "lucide-react";
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

type FilterSource = "all" | "mamago" | "google";
type FilterReply = "all" | "with-reply" | "without-reply";
type FilterStatus = "all" | "published" | "hidden";

export default function BusinessReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Filters
  const [filterSource, setFilterSource] = useState<FilterSource>("all");
  const [filterReply, setFilterReply] = useState<FilterReply>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  // Reply modal state
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [replyReview, setReplyReview] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    withoutReply: 0,
    averageRating: 0,
  });

  useEffect(() => {
    loadReviews();
  }, [filterSource, filterReply, filterStatus]);

  async function loadReviews() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSource !== "all") params.set("source", filterSource);
      if (filterReply !== "all") params.set("hasReply", filterReply === "with-reply" ? "true" : "false");
      if (filterStatus !== "all") params.set("status", filterStatus);

      const response = await fetch(`/api/business/reviews?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setReviews(data.data.reviews);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error("Failed to load reviews:", error);
    } finally {
      setLoading(false);
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
        `/api/business/reviews/place-reviews/${replyReview.id}/reply`,
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
        const error = await response.json();
        alert(error.error || "Ошибка при сохранении ответа");
      }
    } catch (error) {
      console.error("Failed to save reply:", error);
      alert("Ошибка при сохранении ответа");
    } finally {
      setReplyLoading(false);
    }
  }

  async function handleDeleteReply(reviewId: string) {
    if (!confirm("Удалить ответ?")) return;

    setActionLoading(reviewId);
    try {
      const response = await fetch(
        `/api/business/reviews/place-reviews/${reviewId}/reply`,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Отзывы</h1>
        <p className="text-gray-600 mt-2">
          Управляйте отзывами клиентов и отвечайте на них
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Всего отзывов</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <MessageSquare className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Средний рейтинг</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-3xl font-bold text-gray-900">
                  {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "—"}
                </p>
                {stats.averageRating > 0 && <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Без ответа</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{stats.withoutReply}</p>
            </div>
            <MessageSquare className="w-10 h-10 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Источник
            </label>
            <Select value={filterSource} onValueChange={(v) => setFilterSource(v as FilterSource)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="mamago">mamaGo</SelectItem>
                <SelectItem value="google">Google</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Ответ
            </label>
            <Select value={filterReply} onValueChange={(v) => setFilterReply(v as FilterReply)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="without-reply">Без ответа</SelectItem>
                <SelectItem value="with-reply">С ответом</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Статус
            </label>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="published">Опубликованные</SelectItem>
                <SelectItem value="hidden">Скрытые</SelectItem>
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
      {!loading && reviews.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Отзывов пока нет</p>
          <p className="text-gray-500 text-sm mt-2">
            Когда клиенты оставят отзывы, они появятся здесь
          </p>
        </div>
      )}

      {/* Reviews List */}
      {!loading && reviews.length > 0 && (
        <div className="space-y-4">
          {reviews.map((review) => (
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
                    {review.status === "HIDDEN" && (
                      <Badge variant="outline" className="text-gray-600">
                        Скрыт
                      </Badge>
                    )}
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
                    <p className="text-sm font-medium text-blue-900">Ваш ответ</p>
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
                {/* mamaGo actions - only for PUBLISHED reviews */}
                {review.source === "MAMAGO" && review.status === "PUBLISHED" && (
                  <>
                    {!review.ownerReplyText ? (
                      <Button
                        onClick={() => openReplyModal(review)}
                        disabled={actionLoading === review.id}
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

                {/* mamaGo PENDING/HIDDEN - show info */}
                {review.source === "MAMAGO" && review.status !== "PUBLISHED" && (
                  <div className="text-sm text-gray-600">
                    {review.status === "PENDING" && "Отзыв на модерации"}
                    {review.status === "HIDDEN" && "Отзыв скрыт модератором"}
                  </div>
                )}

                {/* Google actions - show link to Google */}
                {review.source === "GOOGLE" && (
                  <div className="text-sm text-gray-600">
                    Отзыв из Google Maps.{" "}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(review.place.title)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Ответить в Google
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
                  Ответ от бизнеса
                </label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 min-h-[150px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Введите ответ от имени вашего бизнеса..."
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
