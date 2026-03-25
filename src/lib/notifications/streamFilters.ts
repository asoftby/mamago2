import type { NotificationType } from "@prisma/client";

/** Личные уведомления (напоминания плана и т.п.) */
export const NOTIFICATION_TYPES_USER: NotificationType[] = ["SYSTEM"];

/** Бизнес: модерация мест/активностей и т.д. */
export const NOTIFICATION_TYPES_BUSINESS: NotificationType[] = [
  "PLACE_APPROVED",
  "PLACE_NEEDS_CHANGES",
  "PLACE_REJECTED",
  "PLACE_UPDATE_APPROVED",
  "PLACE_UPDATE_NEEDS_REVISION",
  "PLACE_UPDATE_REJECTED",
  "ACTIVITY_APPROVED",
  "ACTIVITY_NEEDS_CHANGES",
  "ACTIVITY_REJECTED",
];
