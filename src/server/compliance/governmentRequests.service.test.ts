import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  createGovernmentRequest,
  listGovernmentRequests,
  getGovernmentRequest,
  updateGovernmentRequest,
  GovernmentRequestForbiddenError,
  GovernmentRequestConflictError,
} from "./governmentRequests.service";

const admin = { id: "admin-001", role: "ADMIN" };
const baseInput = {
  authorityName: "Орган",
  incomingNumber: "123/2026",
  receivedDate: "2026-11-17",
  legalBasis: "Текст правового основания",
  requestedScope: "Ограниченный объём сведений",
  subjectUserId: "clabc123456789",
};

function clientWith(tx: object): PrismaClient {
  return {
    $transaction: async (callback: (value: unknown) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaClient;
}

describe("Government requests: audited service boundary", () => {
  it("denies USER and MODERATOR before querying the database", async () => {
    const db = { $transaction: () => { throw new Error("must not touch DB"); } } as unknown as PrismaClient;
    for (const role of ["MODERATOR", "USER"]) {
      await assert.rejects(listGovernmentRequests(db, { id: "other", role }, 1), GovernmentRequestForbiddenError);
      await assert.rejects(createGovernmentRequest(db, { id: "other", role }, baseInput), GovernmentRequestForbiddenError);
      await assert.rejects(getGovernmentRequest(db, { id: "other", role }, "case-id"), GovernmentRequestForbiddenError);
      await assert.rejects(updateGovernmentRequest(db, { id: "other", role }, "case-id", { status: "IN_REVIEW" }), GovernmentRequestForbiddenError);
    }
  });

  it("records a case creation audit without copying sensitive case fields", async () => {
    const audit: Record<string, unknown>[] = [];
    const db = clientWith({
      governmentDataRequest: {
        create: async ({ data }: { data: object }) => ({ id: "case_0123456789", status: "RECEIVED", ...data }),
      },
      adminAuditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { audit.push(data); } },
    });
    const result = await createGovernmentRequest(db, admin, baseInput);
    assert.equal(result.status, "RECEIVED");
    assert.equal(audit.length, 1);
    assert.equal(audit[0].action, "GOVERNMENT_REQUEST_CREATED");
    assert.equal(audit[0].actorId, admin.id);
    assert.equal(JSON.stringify(audit[0]).includes(baseInput.subjectUserId), false);
    assert.equal(JSON.stringify(audit[0]).includes(baseInput.legalBasis), false);
    assert.equal(JSON.stringify(audit[0]).includes(baseInput.requestedScope), false);
  });

  it("refuses to return a registry response when the audit insert fails", async () => {
    const db = clientWith({
      governmentDataRequest: { findMany: async () => [{ id: "case-id" }] },
      adminAuditLog: { create: async () => { throw new Error("audit unavailable"); } },
    });
    await assert.rejects(listGovernmentRequests(db, admin, 1), /audit unavailable/);
  });

  it("rejects terminal transitions without writing a status audit", async () => {
    let wroteAudit = false;
    const db = clientWith({
      governmentDataRequest: { findUnique: async () => ({ id: "case-id", status: "CLOSED" }) },
      adminAuditLog: { create: async () => { wroteAudit = true; } },
    });
    await assert.rejects(
      updateGovernmentRequest(db, admin, "case-id", { status: "IN_REVIEW" }),
      GovernmentRequestConflictError,
    );
    assert.equal(wroteAudit, false);
  });
});
