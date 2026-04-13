/**
 * Guard component that blocks content if business is not verified
 * Use to wrap any UI that requires APPROVED status
 */

import { ReactNode } from "react";
import { BusinessEmptyState } from "@/components/business/ui/BusinessEmptyState";
import { Lock } from "lucide-react";

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
    <div className="mx-auto max-w-2xl px-4 py-12">
      <BusinessEmptyState
        icon={<Lock className="h-7 w-7" />}
        title="Требуется подтверждение бизнеса"
        description={
          status === "DRAFT"
            ? "Отправьте профиль на проверку, чтобы начать публиковать мероприятия и предложения."
            : status === "PENDING"
            ? "Профиль уже на проверке. После одобрения этот раздел станет доступен автоматически."
            : "Заявка была отклонена. Исправьте профиль и отправьте его повторно, чтобы открыть доступ к разделу."
        }
        ctaLabel="Вернуться в Dashboard"
        ctaHref="/business/dashboard"
      />
    </div>
  );
}
