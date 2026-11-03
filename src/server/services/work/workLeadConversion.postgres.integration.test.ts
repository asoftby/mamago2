/**
 * Execute only on the disposable PostgreSQL started by gate-env.sh:
 * RUN_WORK_LOCK_DB_TEST=1 sh scripts/git/gate-env.sh pnpm exec tsx --test src/server/services/work/workLeadConversion.postgres.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { prismaBase } from "@/lib/prisma";
import { createWorkItem, convertLead, WorkDomainError } from "./workService";

test("concurrent lead attachment and conversion cannot leave stranded work items", {
  skip: process.env.RUN_WORK_LOCK_DB_TEST !== "1" ? "requires disposable PostgreSQL" : false,
  timeout: 120_000,
}, async () => {
  const url = process.env.DATABASE_URL;
  if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) {
    throw new Error("Disposable localhost database required");
  }
  const suffix = randomUUID();
  const admin = await prismaBase.user.create({
    data: { email: `crm-lock-admin-${suffix}@example.test`, role: "ADMIN" },
  });
  const owner = await prismaBase.user.create({
    data: { email: `crm-lock-owner-${suffix}@example.test` },
  });
  const business = await prismaBase.business.create({
    data: { name: "CRM lock test", ownerUserId: owner.id },
  });
  const actor = { id: admin.id, role: "ADMIN" as const };

  try {
    for (let round = 0; round < 12; round++) {
      const lead = await prismaBase.crmLead.create({
        data: { name: `CRM concurrent test round ${round}` },
      });
      const outcomes = await Promise.allSettled([
        createWorkItem(actor, {
          title: `Follow-up ${round}`, kind: "SALES", leadId: lead.id,
        }),
        convertLead(actor, lead.id, { businessId: business.id }),
      ]);
      assert.equal(outcomes[1].status, "fulfilled", "conversion must complete");
      if (outcomes[0].status === "rejected") {
        assert.ok(outcomes[0].reason instanceof WorkDomainError,
          "lead attachment can only fail with a business validation error");
        assert.equal(outcomes[0].reason.code, "INVALID_LINK");
      }

      const persisted = await prismaBase.crmLead.findUniqueOrThrow({ where: { id: lead.id } });
      assert.equal(persisted.businessId, business.id);
      const items = await prismaBase.workItem.findMany({ where: { OR: [
        { leadId: lead.id }, { title: `Follow-up ${round}` },
      ] } });
      assert.ok(items.length <= 1, "concurrent create must not duplicate the work item");
      for (const item of items) {
        assert.equal(item.businessId, business.id);
        assert.equal(item.leadId, null, "conversion must migrate all attached work items");
      }
    }
  } finally {
    await prismaBase.workActivity.deleteMany({ where: { actorId: admin.id } });
    await prismaBase.workItem.deleteMany({ where: { createdById: admin.id } });
    await prismaBase.crmLead.deleteMany({ where: { name: { startsWith: "CRM concurrent test round" } } });
    await prismaBase.adminAuditLog.deleteMany({ where: { actorId: admin.id } });
    await prismaBase.business.delete({ where: { id: business.id } });
    await prismaBase.user.deleteMany({ where: { id: { in: [admin.id, owner.id] } } });
  }
});
