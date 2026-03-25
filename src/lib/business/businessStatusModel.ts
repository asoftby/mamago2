/**
 * Разделение уровней статуса в админке B2B:
 *
 * **Заявка на верификацию** — поле `Business.verificationStatus` (и логи):
 * - PENDING, APPROVED, REJECTED, DRAFT, NEEDS_INFO
 * Условно: «BusinessRequest» в продуктовой терминологии.
 *
 * **Видимость бизнеса для пользователей сайта** — поле `Business.operationalStatus`:
 * - ACTIVE — в выдаче, контент виден (при прочих условиях)
 * - DISABLED — мягко скрыто администратором
 * - ARCHIVED — выведен из активной работы, контент не публичен
 *
 * **Legacy** `Business.status` (`BusinessStatus`) — онбординг/модерация бизнеса,
 * не путать с operationalStatus. При одобрении заявки: `status = APPROVED`, `operationalStatus = ACTIVE`.
 */

import type { BusinessOperationalStatus } from "@prisma/client";

export type BusinessVisibilityStatus = BusinessOperationalStatus;

/** Если в ответе API поле отсутствует (старый кэш) — считаем активным. */
export function normalizeBusinessVisibilityStatus(
  value: BusinessVisibilityStatus | null | undefined,
): BusinessVisibilityStatus {
  if (value === "DISABLED") return "DISABLED";
  if (value === "ARCHIVED") return "ARCHIVED";
  return "ACTIVE";
}

/** Публичный сайт: контент бизнеса виден только при ACTIVE. */
export function isBusinessOperationalPubliclyVisible(
  operationalStatus: BusinessOperationalStatus | null | undefined,
): boolean {
  return operationalStatus === "ACTIVE";
}
