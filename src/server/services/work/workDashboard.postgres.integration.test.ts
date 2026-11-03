/**
 * Execute only on the disposable PostgreSQL supplied by gate-env.sh:
 * RUN_CRM_DASHBOARD_DB_TEST=1 sh scripts/git/gate-env.sh pnpm exec tsx --test src/server/services/work/workDashboard.postgres.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { prismaBase } from "@/lib/prisma";
import { listLeads, listWorkItems } from "./workService";
import { crmLeadListQuerySchema, workListQuerySchema } from "./workSchemas";

test("CRM upcoming and lead summaries remain correct beyond 50 tasks and across admins", {
  skip: process.env.RUN_CRM_DASHBOARD_DB_TEST !== "1" ? "requires isolated PostgreSQL" : false,
  timeout: 90_000,
}, async () => {
  const url = process.env.DATABASE_URL;
  if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) {
    throw new Error("A disposable localhost PostgreSQL is required");
  }
  const key = randomUUID();
  const [admin1, admin2] = await Promise.all([
    prismaBase.user.create({ data: { email: `crm-panel-one-${key}@example.test`, role: "ADMIN" } }),
    prismaBase.user.create({ data: { email: `crm-panel-two-${key}@example.test`, role: "ADMIN", displayName: "Второй администратор" } }),
  ]);
  const [lead1, lead2] = await Promise.all([
    prismaBase.crmLead.create({ data: { name: `CRM test old backlog ${key}` } }),
    prismaBase.crmLead.create({ data: { name: `CRM test other administrator ${key}` } }),
  ]);
  try {
    const old = new Date("2020-01-01T12:00:00Z");
    await prismaBase.workItem.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        title: `Old completed ${i}`, kind: "OPERATIONS" as const, status: "DONE" as const,
        dueAt: old, assigneeId: admin1.id, createdById: admin1.id,
        leadId: lead1.id,
      })),
    });
    const future = new Date("2030-12-01T09:00:00Z");
    await prismaBase.workItem.createMany({
      data: [
        { title: "Upcoming private task", kind: "OPERATIONS", status: "NEW",
          dueAt: future, assigneeId: admin1.id, createdById: admin1.id, leadId: lead1.id },
        { title: "Waiting on another admin", kind: "SALES", status: "WAITING",
          dueAt: future, assigneeId: admin2.id, createdById: admin1.id, leadId: lead2.id },
      ],
    });

    const futureResult = await listWorkItems(workListQuerySchema.parse({
      assigneeId: admin1.id, due: "UPCOMING", take: 4,
    }));
    assert.equal(futureResult.total, 1);
    assert.equal(futureResult.items[0]?.title, "Upcoming private task");

    const leads = await listLeads(crmLeadListQuerySchema.parse({ take: 50 }));
    const other = leads.leads.find(row => row.id === lead2.id);
    assert.ok(other, "lead owned by another admin must be returned");
    assert.equal(other.workItems[0]?.title, "Waiting on another admin");
    assert.equal(other.workItems[0]?.assigneeId, admin2.id);
    assert.equal(other.workItems[0]?.status, "WAITING");
    assert.equal(other.workItems[0]?.assignee.displayName, "Второй администратор");
    const first = leads.leads.find(row => row.id === lead1.id);
    assert.equal(first?.workItems[0]?.title, "Upcoming private task",
      "completed backlog must not hide the next action");
  } finally {
    await prismaBase.workItem.deleteMany({ where: { createdById: admin1.id } });
    await prismaBase.crmLead.deleteMany({ where: { id: { in: [lead1.id, lead2.id] } } });
    await prismaBase.user.deleteMany({ where: { id: { in: [admin1.id, admin2.id] } } });
  }
});
