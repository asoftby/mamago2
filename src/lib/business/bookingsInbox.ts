/**
 * Клиентский контракт единого входящего бизнеса (GET /api/business/bookings/inbox).
 * Сервер — источник истины для классификации; здесь только типы, разбор URL и подписи.
 */

export type InboxBucket = "ACTION_REQUIRED" | "UPCOMING" | "AWAITING_CUSTOMER" | "ARCHIVE";
export type InboxTab = "action" | "upcoming" | "customer" | "archive";
export type InboxKind = "all" | "standard" | "party";
export type InboxNextAction =
  | "RESPOND" | "RECONFIRM" | "EXTEND_OR_CLOSE" | "CLOSE_VISIT"
  | "VIEW_UPCOMING" | "WAIT_CUSTOMER" | "VIEW_ARCHIVE";
export type InboxUrgency = "CUSTOMER_WAITING" | "HOUSEKEEPING" | null;
export type InboxPartyStage =
  | "SENT" | "QUOTED" | "AWAITING_RECONFIRM" | "CONFIRMED"
  | "DECLINED" | "EXPIRED" | "NOT_ACCEPTED" | "CANCELLED";

export interface InboxItem {
  id: string;
  kind: "STANDARD" | "PARTY";
  status: string;
  partyStage: InboxPartyStage | null;
  createdAt: string;
  title: string | null;
  offerId: string | null;
  partyOrderId: string | null;
  requestedDate: string | null;
  requestedTime: string | null;
  serviceEndsAt: string | null;
  responseDueAt: string | null;
  quote: { id: string; version: number; status: string; validUntil: string | null } | null;
  bucket: InboxBucket;
  urgency: InboxUrgency;
  nextAction: InboxNextAction;
  deadline: string | null;
}

export interface InboxResponse {
  items: InboxItem[];
  counts: Record<InboxBucket, number>;
  totals: Record<InboxBucket, number>;
  actionGroups: { customerWaiting: number; housekeeping: number };
  menuBadge: number;
  housekeepingTotal: number;
  nearestUpcoming: Array<{ id: string; kind: string; title: string | null; serviceEndsAt: string | null }>;
  hasMore: boolean;
}

export const INBOX_TABS: Array<{ tab: InboxTab; bucket: InboxBucket; label: string }> = [
  { tab: "action", bucket: "ACTION_REQUIRED", label: "Требуют действий" },
  { tab: "upcoming", bucket: "UPCOMING", label: "Предстоящие" },
  { tab: "customer", bucket: "AWAITING_CUSTOMER", label: "Ожидают клиента" },
  { tab: "archive", bucket: "ARCHIVE", label: "Архив" },
];

export const INBOX_KINDS: Array<{ kind: InboxKind; label: string }> = [
  { kind: "all", label: "Все" },
  { kind: "standard", label: "Записи" },
  { kind: "party", label: "Праздники" },
];

const NATIVE_TAB: Record<string, InboxTab> = {
  ACTION_REQUIRED: "action",
  UPCOMING: "upcoming",
  AWAITING_CUSTOMER: "customer",
  ARCHIVE: "archive",
};

/** Принимает короткие значения и нативные bucket-значения; всё остальное — дефолт. */
export function parseInboxTab(value: string | null | undefined): InboxTab {
  if (!value) return "action";
  if (value === "action" || value === "upcoming" || value === "customer" || value === "archive") {
    return value;
  }
  return NATIVE_TAB[value] ?? "action";
}

export function parseInboxKind(value: string | null | undefined): InboxKind {
  return value === "standard" || value === "party" ? value : "all";
}

/** Параметры старого календарного вида: их наличие оставляет пользователя в нём. */
const LEGACY_PARAMS = ["status", "date", "id", "sort"] as const;

export function isLegacyCalendarView(params: { get(name: string): string | null }): boolean {
  if (params.get("view") === "calendar") return true;
  return LEGACY_PARAMS.some((name) => params.get(name) !== null);
}

export const NEXT_ACTION_LABEL: Record<InboxNextAction, string> = {
  RESPOND: "Ответьте клиенту",
  RECONFIRM: "Семья приняла условия — подтвердите бронирование",
  EXTEND_OR_CLOSE: "Предложение истекло",
  CLOSE_VISIT: "Отметьте, состоялся ли визит",
  VIEW_UPCOMING: "Предстоит",
  WAIT_CUSTOMER: "Ждём ответ клиента",
  VIEW_ARCHIVE: "Завершено",
};

export const ARCHIVE_STAGE_LABEL: Record<string, string> = {
  DECLINED: "Вы отказали",
  EXPIRED: "Срок ответа истёк",
  NOT_ACCEPTED: "Клиент не принял предложение",
  CANCELLED: "Отменено",
  CONFIRMED: "Подтверждено",
  COMPLETED: "Состоялось",
  REJECTED: "Отклонено",
};

export function archiveLabel(item: Pick<InboxItem, "kind" | "status" | "partyStage">): string {
  const key = item.kind === "PARTY" ? item.partyStage : item.status;
  return (key && ARCHIVE_STAGE_LABEL[key]) || "Завершено";
}

/** Ключ идемпотентности подходит под /^[A-Za-z0-9_-]{1,128}$/ серверных роутов. */
export function createIdempotencyKey(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${random}`.slice(0, 128);
}

/** Максимальный срок продления: 24 часа, но не позже чем за час до начала. */
export function maxExtendUntil(now: Date, eventStart: Date | null): Date {
  const limit = new Date(now.getTime() + 24 * 3_600_000);
  if (!eventStart) return limit;
  const beforeEvent = new Date(eventStart.getTime() - 3_600_000);
  return beforeEvent < limit ? beforeEvent : limit;
}
