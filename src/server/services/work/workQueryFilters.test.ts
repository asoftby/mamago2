import assert from "node:assert/strict";
import { test } from "node:test";
import { workListQuerySchema } from "./workSchemas";
import { buildWorkItemWhere } from "./workQueryFilters";

test("OVERDUE and WAITING restrict both status and completion state", () => {
  const query = workListQuerySchema.parse({
    status: "WAITING", due: "OVERDUE", kind: "SALES", assigneeId: "clp0o00000000000000000001",
  });
  const where = buildWorkItemWhere(query, new Date("2026-11-03T11:00:00.000Z"));
  assert.equal(where.status, "WAITING");
  assert.deepEqual(where.AND, [{ status: { notIn: ["DONE", "CANCELED"] } }]);
  assert.deepEqual(where.dueAt, { lt: new Date("2026-11-03T11:00:00.000Z") });
  assert.equal(where.kind, "SALES");
});

test("OVERDUE excludes completed items even without an explicit status", () => {
  const where = buildWorkItemWhere(workListQuerySchema.parse({ due: "OVERDUE" }),
    new Date("2026-11-03T10:00:00Z"));
  assert.deepEqual(where.AND, [{ status: { notIn: ["DONE", "CANCELED"] } }]);
  assert.equal(where.status, undefined);
});

test("TODAY follows Minsk midnight even when the server is on UTC", () => {
  const where = buildWorkItemWhere(workListQuerySchema.parse({ due: "TODAY" }),
    new Date("2026-11-02T22:00:00Z"));
  assert.deepEqual(where.dueAt, {
    gte: new Date("2026-11-02T21:00:00Z"),
    lt: new Date("2026-11-03T21:00:00Z"),
  });
});


test("UPCOMING selects only future open tasks after Minsk midnight", () => {
  const where = buildWorkItemWhere(
    workListQuerySchema.parse({ due: "UPCOMING", assigneeId: "clp0o00000000000000000001" }),
    new Date("2026-11-03T12:00:00Z"),
  );
  assert.deepEqual(where.dueAt, { gte: new Date("2026-11-03T21:00:00Z") });
  assert.deepEqual(where.AND, [{ status: { notIn: ["DONE", "CANCELED"] } }]);
});

test("UPCOMING preserves an explicitly requested status", () => {
  const where = buildWorkItemWhere(
    workListQuerySchema.parse({ due: "UPCOMING", status: "WAITING" }),
    new Date("2026-11-03T12:00:00Z"),
  );
  assert.equal(where.status, "WAITING");
  assert.deepEqual(where.AND, [{ status: { notIn: ["DONE", "CANCELED"] } }]);
});

test("TODAY open-only filtering excludes completed tasks before pagination", () => {
  const where = buildWorkItemWhere(workListQuerySchema.parse({
    due: "TODAY", openOnly: "true", assigneeId: "clp0o00000000000000000001",
  }), new Date("2026-11-03T12:00:00Z"));
  assert.deepEqual(where.AND, [{ status: { notIn: ["DONE", "CANCELED"] } }]);
  assert.deepEqual(where.dueAt, {
    gte: new Date("2026-11-02T21:00:00Z"),
    lt: new Date("2026-11-03T21:00:00Z"),
  });
});

test("UPCOMING searches title, next action, business and lead before pagination", () => {
  const where = buildWorkItemWhere(workListQuerySchema.parse({
    due: "UPCOMING", search: "  Клиент Ромашка  ", take: "4",
    assigneeId: "clp0o00000000000000000001",
  }), new Date("2026-11-03T12:00:00Z"));
  assert.deepEqual(where.OR, [
    { title: { contains: "Клиент Ромашка", mode: "insensitive" } },
    { nextAction: { contains: "Клиент Ромашка", mode: "insensitive" } },
    { business: { is: { name: { contains: "Клиент Ромашка", mode: "insensitive" } } } },
    { lead: { is: { name: { contains: "Клиент Ромашка", mode: "insensitive" } } } },
  ]);
  assert.deepEqual(where.AND, [{ status: { notIn: ["DONE", "CANCELED"] } }]);
  assert.deepEqual(where.dueAt, { gte: new Date("2026-11-03T21:00:00Z") });
  assert.equal(where.assigneeId, "clp0o00000000000000000001");
});

test("open-only remains additive with UPCOMING and explicit statuses", () => {
  const where = buildWorkItemWhere(workListQuerySchema.parse({
    due: "UPCOMING", openOnly: "true", status: "WAITING",
  }), new Date("2026-11-03T12:00:00Z"));
  assert.deepEqual(where.AND, [{ status: { notIn: ["DONE", "CANCELED"] } }]);
  assert.equal(where.status, "WAITING");
});
