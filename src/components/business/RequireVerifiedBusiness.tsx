/**
 * Guard component that blocks content if business is not verified
 * Use to wrap any UI that requires APPROVED status
 */

import { ReactNode } from "react";

type VerificationStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

interface RequireVerifiedBusinessProps {
  status: VerificationStatus;
  children: ReactNode;
}

export function RequireVerifiedBusiness({
  status,
  children,
}: RequireVerifiedBusinessProps) {
  if (status === "APPROVED") {
    return <>{children}</>;
  }

  // Blocked state
  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
        <svg
          className="w-16 h-16 text-yellow-600 mx-auto mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Требуется подтверждение бизнеса
        </h2>
        <p className="text-gray-700 mb-6">
          {status === "DRAFT" &&
            "Отправьте профиль на проверку, чтобы начать публиковать мероприятия и услуги."}
          {status === "PENDING" &&
            "Ваш профиль на проверке. После одобрения вы сможете создавать публикации."}
          {status === "REJECTED" &&
            "Ваша заявка была отклонена. Исправьте профиль и отправьте повторно."}
        </p>
        <a
          href="/business/dashboard"
          className="inline-block px-6 py-3 bg-primary text-white rounded-md hover:bg-primary/90"
        >
          Вернуться в панель управления
        </a>
      </div>
    </div>
  );
}
