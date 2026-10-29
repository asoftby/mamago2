import assert from "node:assert/strict";
import {
  CONTENT_STATUS_LABELS_RU,
  ENTITY_TYPE_LABELS_RU,
  USER_EVENT_TYPE_LABELS_RU,
  VERTICAL_LABELS_RU,
  hasLabelRu,
  labelRu,
} from "./labels.ru";

assert.equal(labelRu(CONTENT_STATUS_LABELS_RU, "PENDING"), "На модерации");
assert.equal(labelRu(CONTENT_STATUS_LABELS_RU, null), "—");
assert.equal(labelRu(CONTENT_STATUS_LABELS_RU, "NEW_FUTURE_VALUE"), "NEW_FUTURE_VALUE", "unknown value stays visible");
assert.equal(labelRu(ENTITY_TYPE_LABELS_RU, "PLACE"), "Место");
assert.ok(hasLabelRu(VERTICAL_LABELS_RU, "WEEKEND"));
assert.ok(!hasLabelRu(VERTICAL_LABELS_RU, "toString"), "no prototype keys");

// Every label is Russian text, not a leftover code.
for (const dict of [CONTENT_STATUS_LABELS_RU, ENTITY_TYPE_LABELS_RU, USER_EVENT_TYPE_LABELS_RU, VERTICAL_LABELS_RU]) {
  for (const [code, label] of Object.entries(dict)) {
    assert.match(label, /[А-Яа-яЁё]/, `${code} must have a Russian label`);
  }
}

console.log("labels.ru.test.ts: OK");
