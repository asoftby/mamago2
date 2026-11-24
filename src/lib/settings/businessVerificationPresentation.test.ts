import assert from "node:assert/strict";
import { getBusinessVerificationBadge } from "./businessVerificationPresentation";

const statuses = [
  ["DRAFT", "Черновик"],
  ["PENDING", "На проверке"],
  ["NEEDS_INFO", "Требуется уточнение"],
  ["APPROVED", "Подтверждена"],
  ["REJECTED", "Отклонена"],
] as const;

for (const [status, expectedLabel] of statuses) {
  const badge = getBusinessVerificationBadge(status);
  assert.equal(badge.label, expectedLabel, status);
  assert.equal(badge.toneClass.includes("emerald"), status === "APPROVED", status);
}

for (const unknown of [null, undefined, "", "SUSPENDED", "__proto__"]) {
  const badge = getBusinessVerificationBadge(unknown);
  assert.equal(badge.label, "Статус не определён");
  assert.doesNotMatch(badge.toneClass, /emerald/);
}

console.log("businessVerificationPresentation.test: ok");
