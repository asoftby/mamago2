import { Prisma, type WorkItemKind, type WorkItemStatus } from "@prisma/client";
import { prismaBase } from "@/lib/prisma";
import type { z } from "zod";
import {
  createWorkItemSchema, updateWorkItemSchema, appendWorkActivitySchema,
  createCrmLeadSchema, updateCrmLeadSchema, convertCrmLeadSchema,
  workListQuerySchema, crmLeadListQuerySchema,
} from "./workSchemas";
import { buildWorkItemWhere } from "./workQueryFilters";

export class WorkDomainError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "INVALID_LINK" | "CONFLICT", message: string) {
    super(message);
  }
}

export function isWorkAdmin(user: { role: string } | null | undefined): boolean {
  return user?.role === "ADMIN";
}
type Actor = { id: string; role: "ADMIN" };
type CreateWork = z.infer<typeof createWorkItemSchema>;
type UpdateWork = z.infer<typeof updateWorkItemSchema>;
type CreateLead = z.infer<typeof createCrmLeadSchema>;
type UpdateLead = z.infer<typeof updateCrmLeadSchema>;
type WorkLinks = Pick<CreateWork, "businessId" | "leadId" | "supportThreadId">;
type Tx = Prisma.TransactionClient;

async function ensureAssignee(tx: Tx, id: string) {
  const user = await tx.user.findUnique({ where: { id }, select: { role: true, deletedAt: true } });
  if (!user || user.role !== "ADMIN" || user.deletedAt) {
    throw new WorkDomainError("INVALID_LINK", "Ответственный должен быть действующим администратором");
  }
}

/**
 * A row lock is shared by lead attachment (create/update) and conversion.
 * Under PostgreSQL READ COMMITTED the waiting transaction sees the latest
 * lead.businessId after the lock is granted.
 */
async function lockCrmLead(tx: Tx, leadId: string) {
  await tx.$queryRaw`SELECT "id" FROM "CrmLead" WHERE "id" = ${leadId} FOR UPDATE`;
}

async function verifyLinks(tx: Tx, links: WorkLinks) {
  const { businessId, leadId, supportThreadId } = links;
  if (businessId && leadId) {
    throw new WorkDomainError("INVALID_LINK", "Нельзя одновременно выбрать бизнес и лид");
  }
  if (businessId && !(await tx.business.findUnique({ where: { id: businessId }, select: { id: true } }))) {
    throw new WorkDomainError("INVALID_LINK", "Бизнес не найден");
  }
  if (leadId) {
    await lockCrmLead(tx, leadId);
    const lead = await tx.crmLead.findUnique({
      where: { id: leadId }, select: { id: true, businessId: true },
    });
    if (!lead || lead.businessId) {
      throw new WorkDomainError("INVALID_LINK", "Лид отсутствует или уже привязан к бизнесу");
    }
  }
  if (supportThreadId) {
    const thread = await tx.supportThread.findUnique({
      where: { id: supportThreadId }, select: { businessId: true },
    });
    if (!thread || !businessId || thread.businessId !== businessId) {
      throw new WorkDomainError("INVALID_LINK", "Обращение должно принадлежать выбранному бизнесу");
    }
  }
}

function doneAt(status: WorkItemStatus, previous: Date | null = null): Date | null {
  return status === "DONE" || status === "CANCELED" ? previous ?? new Date() : null;
}

async function audit(tx: Tx, actorId: string, action: string, entityType: string, entityId: string) {
  await tx.adminAuditLog.create({
    data: { actorId, actorRole: "ADMIN", action, entityType, entityId },
  });
}

function normalizeItemsLinks(value: WorkLinks): WorkLinks {
  return {
    businessId: value.businessId ?? null,
    leadId: value.leadId ?? null,
    supportThreadId: value.supportThreadId ?? null,
  };
}

function monetaryAmount(value: string | null | undefined): Prisma.Decimal | null {
  return value == null ? null : new Prisma.Decimal(value);
}

export async function createWorkItem(actor: Actor, input: CreateWork) {
  return prismaBase.$transaction(async (tx) => {
    if (input.createRequestKey) {
      const existing = await tx.workItem.findUnique({
        where: { createRequestKey: input.createRequestKey },
      });
      if (existing) {
        if (existing.createdById !== actor.id) {
          throw new WorkDomainError("CONFLICT", "Ключ создания уже использован");
        }
        return existing;
      }
    }
    const assigneeId = input.assigneeId ?? actor.id;
    await ensureAssignee(tx, assigneeId);
    const links = normalizeItemsLinks(input);
    await verifyLinks(tx, links);
    const item = await tx.workItem.create({
      data: {
        title: input.title,
        kind: input.kind,
        status: input.kind === "SALES" && input.salesStage === "WON" ? "DONE" :
          input.kind === "SALES" && input.salesStage === "LOST" ? "CANCELED" : input.status ?? "NEW",
        salesStage: input.kind === "SALES" ? input.salesStage ?? "FIRST_CONTACT" : null,
        potentialAmountBYN: input.kind === "SALES" ? monetaryAmount(input.potentialAmountBYN) : null,
        nextAction: input.nextAction ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        ...links,
        assigneeId,
        createdById: actor.id,
        createRequestKey: input.createRequestKey ?? null,
        completedAt: doneAt(input.kind === "SALES" && input.salesStage === "WON" ? "DONE" :
          input.kind === "SALES" && input.salesStage === "LOST" ? "CANCELED" : input.status ?? "NEW"),
      },
    });
    await audit(tx, actor.id, "CREATE", "WorkItem", item.id);
    return item;
  });
}

export async function updateWorkItem(actor: Actor, id: string, input: UpdateWork) {
  return prismaBase.$transaction(async (tx) => {
    const previous = await tx.workItem.findUnique({ where: { id } });
    if (!previous) throw new WorkDomainError("NOT_FOUND", "Дело не найдено");
    if (previous.updatedAt.toISOString() !== new Date(input.expectedUpdatedAt).toISOString()) {
      throw new WorkDomainError("CONFLICT", "Дело изменилось. Обновите страницу.");
    }
    const kind: WorkItemKind = input.kind ?? previous.kind;
    const salesStage = input.salesStage === undefined ? previous.salesStage : input.salesStage;
    const amount = input.potentialAmountBYN === undefined
      ? previous.potentialAmountBYN
      : monetaryAmount(input.potentialAmountBYN);
    if (kind !== "SALES" && (salesStage != null || amount != null)) {
      throw new WorkDomainError("INVALID_LINK", "Этап и сумма допустимы только для продажи");
    }
    const assigneeId = input.assigneeId ?? previous.assigneeId;
    if (input.assigneeId) await ensureAssignee(tx, assigneeId);
    const links = {
      businessId: input.businessId === undefined ? previous.businessId : input.businessId,
      leadId: input.leadId === undefined ? previous.leadId : input.leadId,
      supportThreadId: input.supportThreadId === undefined ? previous.supportThreadId : input.supportThreadId,
    };
    await verifyLinks(tx, links);
    const status: WorkItemStatus = kind === "SALES" && salesStage === "WON" ? "DONE" :
      kind === "SALES" && salesStage === "LOST" ? "CANCELED" : input.status ?? previous.status;
    const nextDueAt = input.dueAt === undefined ? previous.dueAt : input.dueAt ? new Date(input.dueAt) : null;
    const updated = await tx.workItem.update({
      where: { id, updatedAt: previous.updatedAt },
      data: {
        title: input.title ?? previous.title, kind, status,
        salesStage: kind === "SALES" ? salesStage : null,
        potentialAmountBYN: kind === "SALES" ? amount : null,
        nextAction: input.nextAction === undefined ? previous.nextAction : input.nextAction,
        dueAt: nextDueAt,
        assigneeId, ...links,
        completedAt: doneAt(status, previous.completedAt),
      },
    });
    const history: Array<{ type: "STATUS_CHANGE" | "ASSIGNMENT_CHANGE" | "DUE_CHANGE"; body: string }> = [];
    if (status !== previous.status) history.push({ type: "STATUS_CHANGE", body: previous.status + " → " + status });
    if (assigneeId !== previous.assigneeId) history.push({ type: "ASSIGNMENT_CHANGE", body: "Ответственный изменён" });
    if (nextDueAt?.getTime() !== previous.dueAt?.getTime()) history.push({ type: "DUE_CHANGE", body: "Срок изменён" });
    if (history.length) {
      await tx.workActivity.createMany({
        data: history.map((event) => ({ ...event, workItemId: id, actorId: actor.id })),
      });
    }
    await audit(tx, actor.id, "UPDATE", "WorkItem", id);
    return updated;
  });
}

export async function appendWorkActivity(actor: Actor, workItemId: string, input: z.infer<typeof appendWorkActivitySchema>) {
  return prismaBase.$transaction(async (tx) => {
    if (!(await tx.workItem.findUnique({ where: { id: workItemId }, select: { id: true } }))) {
      throw new WorkDomainError("NOT_FOUND", "Дело не найдено");
    }
    if (input.requestKey) {
      const old = await tx.workActivity.findUnique({ where: { requestKey: input.requestKey } });
      if (old) {
        if (old.workItemId !== workItemId || old.actorId !== actor.id) {
          throw new WorkDomainError("CONFLICT", "Ключ действия уже использован");
        }
        return old;
      }
    }
    const activity = await tx.workActivity.create({
      data: { workItemId, actorId: actor.id, type: input.type, body: input.body, requestKey: input.requestKey ?? null },
    });
    await audit(tx, actor.id, "ADD_ACTIVITY", "WorkItem", workItemId);
    return activity;
  });
}

export async function listWorkItems(query: z.infer<typeof workListQuerySchema>) {
  const where = buildWorkItemWhere(query, new Date());
  const [total, items] = await Promise.all([
    prismaBase.workItem.count({ where }),
    prismaBase.workItem.findMany({
      where, orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }, { id: "asc" }],
      skip: (query.page - 1) * query.take, take: query.take,
      include: { business: { select: { id: true, name: true } }, lead: { select: { id: true, name: true } } },
    }),
  ]);
  return { total, page: query.page, take: query.take, items };
}

export async function getWorkItem(id: string) {
  const item = await prismaBase.workItem.findUnique({
    where: { id },
    include: {
      business: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true } },
      activities: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
        include: { actor: { select: { id: true, displayName: true } } },
      },
    },
  });
  if (!item) throw new WorkDomainError("NOT_FOUND", "Дело не найдено");
  return item;
}

export async function createLead(actor: Actor, input: CreateLead) {
  return prismaBase.$transaction(async (tx) => {
    if (input.createRequestKey) {
      const existing = await tx.crmLead.findUnique({ where: { createRequestKey: input.createRequestKey } });
      if (existing) return existing;
    }
    const lead = await tx.crmLead.create({
      data: {
        name: input.name, contactName: input.contactName ?? null, phoneE164: input.phoneE164 ?? null,
        email: input.email ?? null, source: input.source ?? null, sourceUrl: input.sourceUrl ?? null,
        createRequestKey: input.createRequestKey ?? null,
      },
    });
    await audit(tx, actor.id, "CREATE", "CrmLead", lead.id);
    return lead;
  });
}

export async function updateLead(actor: Actor, id: string, input: UpdateLead) {
  return prismaBase.$transaction(async (tx) => {
    const old = await tx.crmLead.findUnique({ where: { id } });
    if (!old) throw new WorkDomainError("NOT_FOUND", "Лид не найден");
    if (old.businessId) throw new WorkDomainError("CONFLICT", "Лид уже связан с бизнесом");
    const lead = await tx.crmLead.update({ where: { id }, data: input });
    await audit(tx, actor.id, "UPDATE", "CrmLead", id);
    return lead;
  });
}

export async function listLeads(query: z.infer<typeof crmLeadListQuerySchema>) {
  const where: Prisma.CrmLeadWhereInput = query.search
    ? { OR: [
      { name: { contains: query.search, mode: "insensitive" } },
      { contactName: { contains: query.search, mode: "insensitive" } },
      { phoneE164: { contains: query.search } },
    ] }
    : {};
  const [total, leads] = await Promise.all([
    prismaBase.crmLead.count({ where }),
    prismaBase.crmLead.findMany({
      where, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.take, take: query.take,
      include: {
        business: { select: { id: true, name: true } },
        // Each lead's actual next OPEN task, across all administrators.
        // Relation-level take=1 avoids paginating the global WorkItem list
        // before deriving a particular lead's lifecycle.
        workItems: {
          where: { status: { notIn: ["DONE", "CANCELED"] } },
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }, { id: "asc" }],
          take: 1,
          select: {
            id: true, title: true, status: true, dueAt: true, assigneeId: true,
            assignee: { select: { id: true, displayName: true } },
          },
        },
      },
    }),
  ]);
  return { total, page: query.page, take: query.take, leads };
}

export async function convertLead(actor: Actor, leadId: string, input: z.infer<typeof convertCrmLeadSchema>) {
  return prismaBase.$transaction(async (tx) => {
    await lockCrmLead(tx, leadId);
    const lead = await tx.crmLead.findUnique({ where: { id: leadId } });
    if (!lead) throw new WorkDomainError("NOT_FOUND", "Лид не найден");
    if (lead.businessId && lead.businessId !== input.businessId) {
      throw new WorkDomainError("CONFLICT", "Лид уже связан с другим бизнесом");
    }
    if (!(await tx.business.findUnique({ where: { id: input.businessId }, select: { id: true } }))) {
      throw new WorkDomainError("INVALID_LINK", "Бизнес не найден");
    }
    if (!lead.businessId) {
      const items = await tx.workItem.findMany({ where: { leadId }, select: { id: true } });
      const changed = await tx.crmLead.updateMany({
        where: { id: leadId, businessId: null },
        data: { businessId: input.businessId, convertedAt: new Date() },
      });
      if (changed.count !== 1) {
        throw new WorkDomainError("CONFLICT", "Лид уже конвертируется другим сотрудником");
      }
      await tx.workItem.updateMany({
        where: { leadId }, data: { leadId: null, businessId: input.businessId },
      });
      if (items.length) {
        await tx.workActivity.createMany({
          data: items.map(({ id }) => ({
            workItemId: id, actorId: actor.id, type: "LEAD_CONVERSION",
            body: "Лид привязан к зарегистрированному бизнесу",
          })),
        });
      }
      await audit(tx, actor.id, "CONVERT", "CrmLead", leadId);
    }
    return tx.crmLead.findUniqueOrThrow({ where: { id: leadId } });
  });
}
