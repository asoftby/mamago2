/** Shared (server + admin UI) human labels for Direct complaints. */
import { DirectComplaintStatus } from "@prisma/client";

export const COMPLAINT_REASON_LABELS: Record<string, string> = {
  SPAM: "Спам",
  ABUSE: "Оскорбления",
  SCAM: "Мошенничество",
  OTHER: "Другое",
};

export function complaintReasonLabel(reason: string): string {
  return COMPLAINT_REASON_LABELS[reason] ?? reason;
}

export const COMPLAINT_STATUS_LABELS: Record<DirectComplaintStatus, string> = {
  PENDING: "В ожидании",
  REVIEWED: "Рассмотрена",
  DISMISSED: "Отклонена",
  ACTION_TAKEN: "Приняты меры",
};
