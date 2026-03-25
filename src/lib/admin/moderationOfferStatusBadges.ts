import type { OfferStatus } from "@prisma/client";

/** Бейджи статусов Offer — согласованы по смыслу с фильтром «Мест». */
export const MODERATION_OFFER_STATUS_CONFIG: Record<
  OfferStatus,
  { label: string; variant: "secondary" | "outline" | "default" | "destructive"; className: string }
> = {
  DRAFT: { label: "Черновик", variant: "secondary", className: "" },
  PENDING: {
    label: "На модерации",
    variant: "outline",
    className: "bg-gray-100 text-gray-700 border-gray-200",
  },
  PUBLISHED: { label: "Опубликовано", variant: "default", className: "" },
  REJECTED: { label: "Отклонено", variant: "destructive", className: "" },
};
