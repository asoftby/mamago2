"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type VerificationStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

interface VerificationBannerProps {
  status: VerificationStatus;
  reviewNote?: string | null;
}

export function VerificationBanner({
  status,
  reviewNote,
}: VerificationBannerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/business/verification/submit", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка отправки");
      }

      alert("Заявка отправлена на проверку");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setLoading(false);
    }
  };

  if (status === "APPROVED") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-green-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium text-green-800">
            Ваш бизнес подтвержден
          </span>
        </div>
      </div>
    );
  }

  if (status === "PENDING") {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-yellow-600 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="font-medium text-yellow-800">
            Профиль на проверке
          </span>
        </div>
        <p className="text-sm text-yellow-700 mt-2">
          Мы проверяем вашу заявку. Обычно это занимает 1-2 рабочих дня.
        </p>
      </div>
    );
  }

  if (status === "REJECTED") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <svg
            className="w-5 h-5 text-red-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium text-red-800">Заявка отклонена</span>
        </div>
        {reviewNote && (
          <p className="text-sm text-red-700 mb-3">
            Причина: {reviewNote}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/business/onboarding")}
            className="text-sm text-red-700 hover:text-red-900 underline"
          >
            Редактировать профиль
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="text-sm text-red-700 hover:text-red-900 underline disabled:opacity-50"
          >
            {loading ? "Отправка..." : "Отправить повторно"}
          </button>
        </div>
      </div>
    );
  }

  // DRAFT status
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <svg
          className="w-5 h-5 text-blue-600"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <span className="font-medium text-blue-800">
          Завершите профиль и отправьте на проверку
        </span>
      </div>
      <p className="text-sm text-blue-700 mb-3">
        Заполните все обязательные поля профиля, чтобы начать публиковать
        мероприятия и услуги.
      </p>
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {loading ? "Отправка..." : "Отправить на проверку"}
      </button>
    </div>
  );
}
