import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type WorkItem, isOpen, isUpcoming, minskDateKey, minskInputToIso,
  sortByDeadline, uniqueItems, workStatusLabel,
} from "./workDashboardModel";

const item = (id: string, dueAt: string | null, status: WorkItem["status"] = "NEW"): WorkItem => ({
  id, title: `Дело ${id}`, kind: "OPERATIONS", status, salesStage: null,
  nextAction: null, dueAt, updatedAt: "2026-11-03T12:00:00.000Z",
  assigneeId: "operator", leadId: null, businessId: null, business: null, lead: null,
});

test("Minsk date bucketing uses Minsk, not server or viewer timezone", () => {
  assert.equal(minskDateKey(new Date("2026-11-02T21:30:00Z")), "2026-11-03");
  assert.equal(minskInputToIso("2026-11-03T14:00"), "2026-11-03T11:00:00.000Z");
  assert.equal(minskInputToIso("2026-11-03"), null);
});

test("future items exclude same-day and completed tasks", () => {
  const now = new Date("2026-11-03T10:00:00Z");
  assert.equal(isUpcoming(item("a", "2026-11-04T15:00:00Z"), now), true);
  assert.equal(isUpcoming(item("a", "2026-11-03T12:00:00Z"), now), false);
  assert.equal(isUpcoming(item("a", "2026-11-04T15:00:00Z", "DONE"), now), false);
  assert.equal(isOpen(item("a", null, "WAITING")), true);
  assert.equal(isOpen(item("a", null, "CANCELED")), false);
});

test("merging today and overdue results doesn't duplicate work items", () => {
  const older = item("older", "2026-11-01T09:00:00Z");
  const today = item("today", "2026-11-03T08:00:00Z");
  const merged = sortByDeadline(uniqueItems([older, today], [today]));
  assert.deepEqual(merged.map(row => row.id), ["older", "today"]);
});

test("CRM labels distinguish waiting for a customer from a sales stage", () => {
  assert.equal(workStatusLabel({ ...item("x", null), kind: "SALES" }), "Продажа");
  assert.equal(workStatusLabel({ ...item("x", null), kind: "SALES", status: "WAITING" }), "Ждём клиента");
});
