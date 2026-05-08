"use client";

import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DefaultAuthModal } from "@/components/auth/DefaultAuthModal";
import { PhoneVerificationModal } from "@/components/place/PhoneVerificationModal";

/**
 * ReviewForm - форма для оставления отзыва о месте
 * 
 * ЛОГИКА ВЕРИФИКАЦИИ ТЕЛЕФОНА:
 * 1. Пользователь заполняет форму (рейтинг + текст)
 * 2. Нажимает "Отправить отзыв"
 * 3. Если не авторизован → показываем модалку авторизации
 * 4. Если авторизован, но телефон не подтвержден → показываем модалку подтверждения телефона
 * 5. Если всё ОК → отзыв отправляется на модерацию (status = PENDING)
 * 
 * Таким образом, телефон запрашивается ТОЛЬКО после заполнения формы,
 * а не при открытии модалки отзыва.
 */

interface ReviewFormProps {
  placeId: string;
  placeName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ReviewForm({
  placeId,
  placeName,
  onSuccess,
  onCancel,
}: ReviewFormProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rating === 0) {
      setError("Пожалуйста, выберите оценку");
      return;
    }

    if (text.trim().length < 10) {
      setError("Отзыв должен содержать минимум 10 символов");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/places/${placeId}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating,
          text: text.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Обработка специфичных ошибок
        if (data.error === "UNAUTHORIZED") {
          // Открыть модальное окно авторизации
          setShowAuthModal(true);
          return;
        }
        
        if (data.error === "PHONE_NOT_VERIFIED") {
          // Открыть модальное окно подтверждения телефона
          setShowPhoneModal(true);
          return;
        }
        
        if (data.error === "REVIEW_EXISTS") {
          setError("Вы уже оставили отзыв об этом месте");
          return;
        }
        
        if (data.error === "TEXT_TOO_SHORT") {
          setError("Отзыв должен содержать минимум 10 символов");
          return;
        }
        
        throw new Error(data.message || "Не удалось отправить отзыв");
      }

      setSuccess(true);
      
      // Вызвать callback через 2 секунды
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
      }, 2000);
    } catch (err) {
      console.error("Error submitting review:", err);
      setError(err instanceof Error ? err.message : "Произошла ошибка при отправке отзыва");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    // Попробовать отправить отзыв снова
    handleSubmit(new Event("submit") as unknown as React.FormEvent);
  };

  const handlePhoneVerified = () => {
    setShowPhoneModal(false);
    // Попробовать отправить отзыв снова
    handleSubmit(new Event("submit") as unknown as React.FormEvent);
  };

  const displayRating = hoveredRating || rating;

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900">
          Спасибо за отзыв!
        </h3>
        <p className="text-gray-600">
          Ваш отзыв отправлен на модерацию и появится на странице после проверки.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Оставить отзыв о {placeName}
        </h3>
        <p className="text-sm text-gray-600">
          Поделитесь своими впечатлениями о посещении этого места
        </p>
      </div>

      {/* Rating */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Ваша оценка <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            >
              <Star
                className={`w-8 h-8 ${
                  star <= displayRating
                    ? "fill-yellow-400 text-yellow-400"
                    : "fill-gray-200 text-gray-200"
                }`}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 text-sm text-gray-600">
              {rating === 1 && "Плохо"}
              {rating === 2 && "Неплохо"}
              {rating === 3 && "Нормально"}
              {rating === 4 && "Хорошо"}
              {rating === 5 && "Отлично"}
            </span>
          )}
        </div>
      </div>

      {/* Text */}
      <div className="space-y-2">
        <label htmlFor="review-text" className="block text-sm font-medium text-gray-700">
          Ваш отзыв <span className="text-red-500">*</span>
        </label>
        <Textarea
          id="review-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Расскажите о своих впечатлениях: что понравилось, что можно улучшить..."
          rows={6}
          maxLength={5000}
          className="resize-none"
          disabled={isSubmitting}
        />
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Минимум 10 символов</span>
          <span>{text.length} / 5000</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={isSubmitting || rating === 0 || text.trim().length < 10}
          className="flex-1"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Отправка...
            </>
          ) : (
            "Отправить отзыв"
          )}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Отмена
          </Button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Отзыв будет опубликован после модерации. Мы проверяем все отзывы чтобы убедиться что они соответствуют нашим правилам.
      </p>

      {/* Auth Modal */}
      <DefaultAuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        nextHref={typeof window !== "undefined" ? window.location.pathname : "/"}
        title="Войдите чтобы оставить отзыв"
        subtitle="Это поможет нам убедиться что отзывы оставляют реальные люди"
        authEntryPoint="profile"
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Phone Verification Modal */}
      <PhoneVerificationModal
        open={showPhoneModal}
        onClose={() => setShowPhoneModal(false)}
        onVerified={handlePhoneVerified}
      />
    </form>
  );
}
