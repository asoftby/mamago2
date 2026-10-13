import { createHash } from "node:crypto";
import { stableJsonStringify } from "@/lib/json/stableJsonStringify";
import { OFFER_OPERATIONAL_COLUMNS, normalizeForCompare } from "./offerPublishedEditGate";

/**
 * Операционные колонки Offer (цены, смены, телефоны), чьё чужое изменение нельзя затирать устаревшим
 * снимком формы. `priceTextDerived` — служебное имя гейта, в строке это `priceText`.
 */
const OPERATIONAL_VERSION_COLUMNS: readonly string[] = [
  ...new Set([...OFFER_OPERATIONAL_COLUMNS].map((column) => (column === "priceTextDerived" ? "priceText" : column))),
].sort();

/**
 * «Версия» операционных данных оффера: хэш значений колонок, а не `updatedAt`. Фоновые задачи после
 * ответа (slug, проекции, счётчики) двигают `updatedAt`, не меняя цены/смены/телефоны — по `updatedAt`
 * владелец получал бы ложные конфликты. Сервер отдаёт версию форме и сверяет её при сохранении.
 */
export function offerOperationalVersion(row: Record<string, unknown>): string {
  const snapshot = Object.fromEntries(
    OPERATIONAL_VERSION_COLUMNS.map((column) => [column, normalizeForCompare(row[column])]),
  );
  return createHash("sha1").update(stableJsonStringify(snapshot)).digest("hex").slice(0, 16);
}
