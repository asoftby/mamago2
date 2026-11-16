import type { ContentStatus, OfferStatus } from "@prisma/client";
import type { EventTemporalState } from "@/lib/events/eventTemporalState";

/**
 * Единое ВЫЧИСЛЯЕМОЕ представление статуса публикации для бизнес-кабинета.
 *
 * Не новая state machine и не поле БД: из существующих данных (статус
 * публикации, archivedAt, временное состояние события) выводится один итоговый
 * статус. Статус записи (BookingRequest) сюда не входит и не заменяется.
 *
 * Приоритет (сверху вниз):
 *  cancelled → unpublished (архив / DELETED) → draft → rejected → pending
 *  → needsRevision → past (только Event) → active.
 */
export type PublicationDisplayStatusKey =
  | "active"
  | "past"
  | "draft"
  | "pending"
  | "needsRevision"
  | "rejected"
  | "unpublished"
  | "cancelled"
  | "scheduled";

export type PublicationDisplayTone = "success" | "muted" | "warning" | "danger";

export interface PublicationDisplayStatus {
  key: PublicationDisplayStatusKey;
  label: string;
  tone: PublicationDisplayTone;
}

const META: Record<PublicationDisplayStatusKey, PublicationDisplayStatus> = {
  active: { key: "active", label: "Активно", tone: "success" },
  past: { key: "past", label: "Прошло", tone: "muted" },
  draft: { key: "draft", label: "Черновик", tone: "muted" },
  pending: { key: "pending", label: "На модерации", tone: "warning" },
  needsRevision: { key: "needsRevision", label: "Требует правок", tone: "warning" },
  rejected: { key: "rejected", label: "Отклонено", tone: "danger" },
  unpublished: { key: "unpublished", label: "Снято с публикации", tone: "muted" },
  cancelled: { key: "cancelled", label: "Отменено", tone: "danger" },
  // В системе нет отложенной публикации событий/мест/офферов; статус SCHEDULED
  // существует только для журнала. Оставляем прежнюю подпись, ничего не выдумываем.
  scheduled: { key: "scheduled", label: "Запланировано", tone: "warning" },
};

export interface PublicationDisplayStatusInput {
  /** ContentStatus (Event/Place) или OfferStatus. */
  status: ContentStatus | OfferStatus;
  /** Place/Offer: мягкая архивация поверх статуса. */
  archivedAt?: Date | string | null;
  /**
   * Только для Event: состояние по расписанию (getEventTemporalState).
   * Для Place/Offer не передавать — «Прошло» к ним не применяется.
   */
  temporalState?: EventTemporalState | null;
  /**
   * Только для Event. В модели данных пока нет признака отмены организатором;
   * параметр оставлен, чтобы при его появлении не менять приоритеты.
   */
  isCancelled?: boolean;
}

export function resolvePublicationDisplayStatus(
  input: PublicationDisplayStatusInput,
): PublicationDisplayStatus {
  if (input.isCancelled) return META.cancelled;
  if (input.archivedAt) return META.unpublished;

  switch (input.status) {
    case "ARCHIVED":
    case "DELETED":
      return META.unpublished;
    case "DRAFT":
      return META.draft;
    case "REJECTED":
      return META.rejected;
    case "PENDING":
    case "PENDING_UPDATE":
      return META.pending;
    case "NEEDS_REVISION":
      return META.needsRevision;
    case "SCHEDULED":
      return META.scheduled;
    case "PUBLISHED":
      return input.temporalState === "PAST" ? META.past : META.active;
    default:
      return META.draft;
  }
}

/** Публикация публично доступна и актуальна — можно продвигать/показывать как живую. */
export function isPublicationActive(input: PublicationDisplayStatusInput): boolean {
  return resolvePublicationDisplayStatus(input).key === "active";
}

export const PUBLICATION_DISPLAY_TONE_CLASS: Record<PublicationDisplayTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  muted: "border-stone-200 bg-stone-50 text-stone-600",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-700",
};
