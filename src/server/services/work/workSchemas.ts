import { z } from "zod";

/** Strict server input: the CRM is staff-only and handles private contact data. */
const id = z.string().cuid();
const title = z.string().trim().min(1).max(240);
const text = z.string().trim().max(1000);
const nullableId = id.nullable().optional();
const date = z.iso.datetime({ offset: true }).nullable().optional();
const amount = z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/, "Сумма в BYN, не более 2 знаков после запятой");

export const workKind = z.enum(["SALES", "SERVICE", "OPERATIONS"]);
export const workStatus = z.enum(["NEW", "IN_PROGRESS", "WAITING", "DONE", "CANCELED"]);
export const workSalesStage = z.enum([
  "FIRST_CONTACT", "CONTACTED", "OFFER_SENT", "PAYMENT_PENDING", "WON", "LOST",
]);
export const workActivityType = z.enum([
  "CALL", "MESSAGE", "MEETING", "NOTE",
  "STATUS_CHANGE", "ASSIGNMENT_CHANGE", "DUE_CHANGE", "LEAD_CONVERSION",
]);

export const createWorkItemSchema = z.strictObject({
  title,
  kind: workKind,
  status: workStatus.optional(),
  salesStage: workSalesStage.nullable().optional(),
  potentialAmountBYN: amount.nullable().optional(),
  nextAction: text.nullable().optional(),
  dueAt: date,
  assigneeId: id.optional(),
  businessId: nullableId,
  leadId: nullableId,
  supportThreadId: nullableId,
  createRequestKey: z.string().uuid().optional(),
}).superRefine((value, ctx) => {
  if (value.leadId && value.businessId) {
    ctx.addIssue({ code: "custom", path: ["leadId"], message: "Выберите одного клиента" });
  }
  if (value.kind !== "SALES" && (value.salesStage != null || value.potentialAmountBYN != null)) {
    ctx.addIssue({ code: "custom", path: ["salesStage"], message: "Этап и сумма допустимы только для продаж" });
  }
});

export const updateWorkItemSchema = z.strictObject({
  title: title.optional(),
  kind: workKind.optional(),
  status: workStatus.optional(),
  salesStage: workSalesStage.nullable().optional(),
  potentialAmountBYN: amount.nullable().optional(),
  nextAction: text.nullable().optional(),
  dueAt: date,
  assigneeId: id.optional(),
  businessId: nullableId,
  leadId: nullableId,
  supportThreadId: nullableId,
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});

export const appendWorkActivitySchema = z.strictObject({
  type: z.enum(["CALL", "MESSAGE", "MEETING", "NOTE"]),
  body: z.string().trim().min(1).max(4000),
  requestKey: z.string().uuid().optional(),
});

export const createCrmLeadSchema = z.strictObject({
  name: z.string().trim().min(2).max(200),
  contactName: z.string().trim().max(200).nullable().optional(),
  phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable().optional(),
  email: z.email().max(254).nullable().optional(),
  source: z.string().trim().max(64).nullable().optional(),
  sourceUrl: z.url().max(2048).refine((value) => /^https?:\/\//i.test(value), "Только HTTP(S)").nullable().optional(),
  createRequestKey: z.string().uuid().optional(),
});

export const updateCrmLeadSchema = createCrmLeadSchema.omit({ createRequestKey: true }).partial();

export const convertCrmLeadSchema = z.strictObject({
  businessId: id,
});

/** A capped list response; never allow unbounded contact exports. */
export const workListQuerySchema = z.strictObject({
  search: z.string().trim().max(200).optional(),
  kind: workKind.optional(),
  status: workStatus.optional(),
  assigneeId: id.optional(),
  due: z.enum(["TODAY", "OVERDUE", "NO_DUE"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  take: z.coerce.number().int().min(1).max(50).default(30),
});

export const crmLeadListQuerySchema = z.strictObject({
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  take: z.coerce.number().int().min(1).max(50).default(30),
});
