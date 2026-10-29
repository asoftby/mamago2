import assert from "node:assert/strict";
import { classifyImportSource, mayOverwriteNonEmpty, sourcePriority } from "./source-field-priority";
import { filterActivityNonDestructiveUpdates, type MappedActivityFields } from "./event-field-mapper";

assert.equal(classifyImportSource({ parserKey: "abws-performances-event", isOrganizerSource: false }), "ABWS");
assert.equal(classifyImportSource({ parserKey: "family-by-afisha-event", isOrganizerSource: false }), "FAMILY_BY");
assert.equal(classifyImportSource({ parserKey: "telegram-channel-event", isOrganizerSource: false }), "TELEGRAM_AGGREGATOR");
assert.equal(classifyImportSource({ parserKey: "telegram-channel-event", isOrganizerSource: true }), "ORGANIZER");
assert.equal(classifyImportSource({ parserKey: null, isOrganizerSource: false }), "OTHER");

// Цена/сеансы: ABWS > организатор > family.by > агрегатор.
assert.ok(sourcePriority("commerce", "ABWS") > sourcePriority("commerce", "ORGANIZER"));
assert.ok(sourcePriority("commerce", "ORGANIZER") > sourcePriority("commerce", "FAMILY_BY"));
assert.ok(sourcePriority("commerce", "FAMILY_BY") > sourcePriority("commerce", "TELEGRAM_AGGREGATOR"));
// Описание/возраст: организатор > ABWS > family.by > агрегатор.
assert.ok(sourcePriority("content", "ORGANIZER") > sourcePriority("content", "ABWS"));
assert.ok(sourcePriority("content", "ABWS") > sourcePriority("content", "FAMILY_BY"));
assert.ok(sourcePriority("content", "FAMILY_BY") > sourcePriority("content", "TELEGRAM_AGGREGATOR"));
// Обложка: организатор > ABWS > остальные.
assert.ok(sourcePriority("cover", "ORGANIZER") > sourcePriority("cover", "ABWS"));
assert.ok(sourcePriority("cover", "ABWS") > sourcePriority("cover", "TELEGRAM_AGGREGATOR"));

assert.equal(mayOverwriteNonEmpty("content", "TELEGRAM_AGGREGATOR"), false);
assert.equal(mayOverwriteNonEmpty("commerce", "TELEGRAM_AGGREGATOR"), false);
assert.equal(mayOverwriteNonEmpty("content", "ABWS"), true);
assert.equal(mayOverwriteNonEmpty("content", "FAMILY_BY"), true);

const mapped = { description: "Очень длинное описание из канала, длиннее прежнего" } as MappedActivityFields;
const existing = { description: "Короткое описание организатора" };

// Агрегатор не заменяет непустое описание, даже если его текст длиннее.
{
  const { updates, skipped } = filterActivityNonDestructiveUpdates(mapped, existing, { incomingSourceKind: "TELEGRAM_AGGREGATOR" });
  assert.equal(updates.description, undefined);
  assert.ok(skipped.includes("description (aggregator never overwrites)"));
}
// Агрегатор заполняет пустое описание.
{
  const { updates } = filterActivityNonDestructiveUpdates(mapped, { description: "  " }, { incomingSourceKind: "TELEGRAM_AGGREGATOR" });
  assert.equal(updates.description, mapped.description);
}
// ABWS, family.by и вызов без источника ведут себя по-старому: длиннее заменяет.
for (const options of [{ incomingSourceKind: "ABWS" as const }, { incomingSourceKind: "FAMILY_BY" as const }, {}]) {
  const { updates } = filterActivityNonDestructiveUpdates(mapped, existing, options);
  assert.equal(updates.description, mapped.description);
}

console.log("source-field-priority tests: OK");
