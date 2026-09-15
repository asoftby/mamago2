import assert from "node:assert/strict";

import { deriveSchedulingKindFromScheduleItems } from "./deriveSchedulingKind";

assert.equal(
  deriveSchedulingKindFromScheduleItems([
    { isMultiDay: false, date: "2026-09-20", dateEnd: null, allDay: false },
  ]),
  "SLOT",
);

assert.equal(
  deriveSchedulingKindFromScheduleItems([
    { isMultiDay: true, date: "2026-09-20", dateEnd: "2026-09-25", allDay: false },
  ]),
  "WINDOW",
);

assert.equal(
  deriveSchedulingKindFromScheduleItems([
    { isMultiDay: false, date: "2026-09-20", dateEnd: null, allDay: true },
  ]),
  "WINDOW",
);

assert.equal(
  deriveSchedulingKindFromScheduleItems([
    { isMultiDay: false, date: "2026-09-20", dateEnd: "2026-09-21", allDay: false },
  ]),
  "WINDOW",
);

assert.equal(deriveSchedulingKindFromScheduleItems([]), "SLOT");

console.log("deriveSchedulingKind tests: OK");
