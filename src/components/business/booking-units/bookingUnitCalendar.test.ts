import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const manager = readFileSync("src/components/business/booking-units/BookingUnitManager.tsx", "utf8");
const calendar = readFileSync("src/components/business/booking-units/BookingUnitCalendar.tsx", "utf8");
assert.ok(manager.includes("<BookingUnitCalendar unitId={editingId} />"), "calendar must be accessible while editing");
assert.ok(manager.indexOf("</form>\n        {editingId ? <BookingUnitCalendar") >= 0, "no nested forms");
for (const check of ["datetime-local", "minskISO(start)", "minskISO(end)", 'method: "POST"', 'method: "DELETE"', "encodeURIComponent(unitId)", 'entry.source === "MANUAL"', "window.confirm"]) {
  assert.ok(calendar.includes(check), "Missing calendar UI contract: " + check);
}
assert.ok(calendar.includes("setRangeFrom(chosenDate)"), "newly created future blocks must remain visible");
assert.ok(calendar.includes("type=\"date\" value={rangeFrom}"), "owner must be able to navigate future dates");
console.log("bookingUnitCalendar.test.ts: OK");
