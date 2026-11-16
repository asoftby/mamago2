/**
 * Slot dates must survive "calendar widget -> YYYY-MM-DD -> saved -> reopened" in every
 * browser time zone. The suite re-runs itself in child processes with TZ set, because the
 * zone is fixed when the Node process starts.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  formatSlotDateLabel,
  localDateToSlotDate,
  parseSlotDate,
  slotDateToLocalDate,
} from "./slotDate";

const ZONES = [
  "Etc/GMT+10", // UTC-10 (POSIX sign is inverted)
  "Pacific/Honolulu", // UTC-10, the real zone
  "Europe/Minsk", // UTC+3, the product's zone
  "Pacific/Kiritimati", // UTC+14, the furthest east
  "Pacific/Pago_Pago", // UTC-11
  "America/Los_Angeles", // DST
  "America/Havana", // DST jump AT local midnight (midnight does not exist on that day)
  "Asia/Beirut", // DST jump at local midnight
  "Pacific/Auckland", // DST, southern hemisphere
  "UTC",
];

const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function ymd(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function runInZone(expectedZone: string): void {
  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
  assert.equal(resolved, expectedZone, `child must run in ${expectedZone}, got ${resolved}`);

  // Every day of 2024..2028 (leap years 2024 and 2028 included), enumerated in UTC so the
  // sequence itself does not depend on the zone under test.
  let checked = 0;
  for (let t = Date.UTC(2024, 0, 1); t <= Date.UTC(2028, 11, 31); t += 86_400_000) {
    const u = new Date(t);
    const y = u.getUTCFullYear();
    const m = u.getUTCMonth() + 1;
    const d = u.getUTCDate();
    const value = ymd(y, m, d);

    assert.deepEqual(parseSlotDate(value), { year: y, month: m, day: d }, `${value} parses`);

    // saved value -> widget Date -> value (reopening the picker)
    const widgetValue = slotDateToLocalDate(value);
    assert.ok(widgetValue, `${value} -> Date`);
    assert.equal(localDateToSlotDate(widgetValue), value, `${value} reopen round trip in ${expectedZone}`);

    // what the Calendar widget itself returns for a clicked day: local midnight
    assert.equal(localDateToSlotDate(new Date(y, m - 1, d)), value, `${value} click round trip in ${expectedZone}`);

    // the label shows the very same day, never the neighbour
    const label = formatSlotDateLabel(value);
    assert.ok(label?.startsWith(`${d} ${MONTHS_GENITIVE[m - 1]} ${y}`), `${value} label "${label}" in ${expectedZone}`);
    checked += 1;
  }
  assert.ok(checked >= 1800, "enough days checked");
}

function runInvalidAndEdgeCases(): void {
  for (const bad of ["", "2026-1-1", "26-01-01", "2026-13-01", "2026-00-10", "2026-01-00", "2026-02-30", "2026-04-31", "2026-02-29", "1900-02-29", "2026-11-16T10:00", " 2026-11-16", "abcd-ef-gh"]) {
    assert.equal(parseSlotDate(bad), null, `"${bad}" must be rejected`);
    assert.equal(slotDateToLocalDate(bad), null, `"${bad}" has no widget date`);
    assert.equal(formatSlotDateLabel(bad), null, `"${bad}" has no label`);
  }
  for (const good of ["2028-02-29", "2000-02-29", "2026-12-31", "2026-01-01"]) {
    assert.ok(parseSlotDate(good), `"${good}" must parse`);
  }
}

function runZoneHazardDocumentation(zone: string): void {
  // Documents why toISOString() is forbidden: east of Greenwich it moves the date back a day.
  const viaIso = new Date(2026, 10, 16).toISOString().slice(0, 10);
  if (zone === "Europe/Minsk" || zone === "Pacific/Kiritimati") {
    assert.equal(viaIso, "2026-11-15", `toISOString shifts the date in ${zone}`);
  }
  assert.equal(localDateToSlotDate(new Date(2026, 10, 16)), "2026-11-16", `helper keeps the date in ${zone}`);
}

if (process.env.SLOT_DATE_TZ_CHILD) {
  runInZone(process.env.SLOT_DATE_TZ_CHILD);
  runZoneHazardDocumentation(process.env.SLOT_DATE_TZ_CHILD);
  runInvalidAndEdgeCases();
} else {
  runInvalidAndEdgeCases();
  for (const zone of ZONES) {
    const child = spawnSync(process.execPath, [...process.execArgv, process.argv[1]!], {
      env: { ...process.env, TZ: zone, SLOT_DATE_TZ_CHILD: zone },
      encoding: "utf8",
    });
    assert.equal(child.status, 0, `time zone ${zone} failed:\n${child.stdout}\n${child.stderr}`);
  }
  console.log(`slotDate.test.ts: OK (${ZONES.length} time zones, ~1800 days each)`);
}
