import assert from "node:assert/strict";
import { planEntryDisplay } from "./planEntryDisplay";

assert.equal(planEntryDisplay({}).title, "Запись");
assert.equal(planEntryDisplay({ title: "Заметка" }).title, "Заметка");
assert.equal(planEntryDisplay({ title: "Старое", activity: { title: "Событие" } }).title, "Событие");
assert.equal(planEntryDisplay({ title: "  " }).title, "Запись");
assert.equal(planEntryDisplay({ coverImageUrl: "fallback", activity: { title: "Событие", coverImageUrl: "image" } }).poster, "image");
assert.equal(planEntryDisplay({ startsAt: "2026-10-19T12:30:00.000Z" }).time !== null, true);
console.log("planEntryDisplay: OK");
