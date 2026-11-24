import type { BusinessVerificationStatus } from "@prisma/client";

export type BusinessVerificationBadge = Readonly<{
  label: string;
  toneClass: string;
}>;

/** Display only the persisted business verification status; never assume approval. */
const BADGES: Record<BusinessVerificationStatus, BusinessVerificationBadge> = {
  DRAFT: {
    label: "Черновик",
    toneClass: "border-stone-200 bg-stone-50 text-stone-700",
  },
  PENDING: {
    label: "На проверке",
    toneClass: "border-amber-200 bg-amber-50 text-amber-800",
  },
  NEEDS_INFO: {
    label: "Требуется уточнение",
    toneClass: "border-amber-200 bg-amber-50 text-amber-800",
  },
  APPROVED: {
    label: "Подтверждена",
    toneClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  REJECTED: {
    label: "Отклонена",
    toneClass: "border-red-200 bg-red-50 text-red-700",
  },
};

const UNKNOWN_BADGE: BusinessVerificationBadge = {
  label: "Статус не определён",
  toneClass: "border-stone-200 bg-stone-50 text-stone-700",
};

export function getBusinessVerificationBadge(
  status: string | null | undefined,
): BusinessVerificationBadge {
  return status && Object.prototype.hasOwnProperty.call(BADGES, status)
    ? BADGES[status as BusinessVerificationStatus]
    : UNKNOWN_BADGE;
}
