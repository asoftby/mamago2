import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendWorkActivitySchema,
  createCrmLeadSchema,
  createWorkItemSchema,
  updateWorkItemSchema,
  workListQuerySchema,
} from "./workSchemas";

const BUSINESS_ID = "clp0o00000000000000000001";
const LEAD_ID = "clp0o00000000000000000002";

test("operations can be created without a client", () => {
  const input = createWorkItemSchema.parse({
    title: "  Подготовить подборку  ",
    kind: "OPERATIONS",
    dueAt: "2026-11-04T09:00:00+03:00",
  });
  assert.equal(input.title, "Подготовить подборку");
  assert.equal(input.kind, "OPERATIONS");
});

test("sales stage and amount only valid for sales", () => {
  const input = createWorkItemSchema.parse({
    title: "Отправить КП", kind: "SALES", salesStage: "OFFER_SENT", potentialAmountBYN: "450.00",
  });
  assert.equal(input.potentialAmountBYN, "450.00");
  assert.equal(createWorkItemSchema.safeParse({
    title: "Встреча", kind: "SERVICE", salesStage: "OFFER_SENT",
  }).success, false);
  assert.equal(createWorkItemSchema.safeParse({
    title: "Встреча", kind: "OPERATIONS", potentialAmountBYN: "40.00",
  }).success, false);
});

test("an item cannot point to Business and CrmLead simultaneously", () => {
  assert.equal(createWorkItemSchema.safeParse({
    title: "Позвонить", kind: "SALES", businessId: BUSINESS_ID, leadId: LEAD_ID,
  }).success, false);
});

test("money, dates and history have strict formats", () => {
  assert.equal(createWorkItemSchema.safeParse({
    title: "Проверка", kind: "SALES", potentialAmountBYN: "10.999",
  }).success, false);
  assert.equal(createWorkItemSchema.safeParse({
    title: "Проверка", kind: "SERVICE", dueAt: "2026-11-04",
  }).success, false);
  assert.equal(appendWorkActivitySchema.safeParse({
    type: "STATUS_CHANGE", body: "Нельзя подделывать системную историю",
  }).success, false);
  assert.equal(appendWorkActivitySchema.parse({ type: "CALL", body: "Созвонились" }).type, "CALL");
});

test("contacts and lead source URL are validated, arbitrary properties rejected", () => {
  const input = createCrmLeadSchema.parse({
    name: "Батутный центр", phoneE164: "+375291234567", source: "TELEGRAM",
    sourceUrl: "https://example.com",
  });
  assert.equal(input.source, "TELEGRAM");
  assert.equal(createCrmLeadSchema.safeParse({
    name: "Тест", sourceUrl: "file:///etc/passwd",
  }).success, false);
  assert.equal(createCrmLeadSchema.safeParse({
    name: "Тест", extra: "arbitrary",
  }).success, false);
});

test("updates require optimistic concurrency token and list reads are capped", () => {
  assert.equal(updateWorkItemSchema.safeParse({
    status: "DONE",
  }).success, false);
  assert.equal(updateWorkItemSchema.safeParse({
    status: "DONE", expectedUpdatedAt: "2026-11-03T12:00:00Z",
  }).success, true);
  assert.equal(workListQuerySchema.safeParse({ take: "99999" }).success, false);
  assert.equal(workListQuerySchema.parse({}).take, 30);
});
