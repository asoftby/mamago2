import assert from "node:assert/strict";

import {
  addDaysLocal,
  formatLocalPlanDate,
  getLocalDateKey,
} from "./localDateKey";

{
  const date = new Date(2026, 3, 24, 2, 28, 0, 0);
  assert.equal(getLocalDateKey(date), "2026-04-24");
}

{
  assert.equal(addDaysLocal("2026-04-24", 1), "2026-04-25");
  assert.equal(addDaysLocal("2026-04-24", -1), "2026-04-23");
}

{
  assert.equal(formatLocalPlanDate("2026-04-24", "ru-RU"), "24 апреля");
}

console.log("localDateKey tests: OK");
