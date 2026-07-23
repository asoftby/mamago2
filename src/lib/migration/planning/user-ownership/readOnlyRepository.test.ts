import assert from "node:assert/strict";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { createReadOnlyPrismaClient, ReadOnlyViolationError } from "./readOnlyRepository";

/**
 * These assertions must hold *before* any database access happens — the
 * extension's `$allOperations` guard throws synchronously ahead of calling
 * the real `query(args)`, so none of these calls ever reach Postgres, even
 * against a throwaway id that doesn't exist.
 */
test("write operations are rejected before touching the database", async () => {
  const client = createReadOnlyPrismaClient(new PrismaClient());
  await assert.rejects(() => client.user.create({ data: { email: "should-never-be-created@example.invalid", role: "USER", status: "ACTIVE" } }), ReadOnlyViolationError);
  await assert.rejects(() => client.user.update({ where: { id: "does-not-exist" }, data: { role: "ADMIN" } }), ReadOnlyViolationError);
  await assert.rejects(() => client.user.upsert({ where: { id: "does-not-exist" }, create: { email: "x@example.invalid", role: "USER", status: "ACTIVE" }, update: {} }), ReadOnlyViolationError);
  await assert.rejects(() => client.user.delete({ where: { id: "does-not-exist" } }), ReadOnlyViolationError);
  await assert.rejects(() => client.user.deleteMany({ where: {} }), ReadOnlyViolationError);
  await assert.rejects(() => client.migrationLineage.create({ data: {} as never }), ReadOnlyViolationError);
});

test("$executeRaw and $executeRawUnsafe are rejected before touching the database", async () => {
  const client = createReadOnlyPrismaClient(new PrismaClient());
  await assert.rejects(() => client.$executeRaw`SELECT 1`, ReadOnlyViolationError);
  await assert.rejects(() => client.$executeRawUnsafe("SELECT 1"), ReadOnlyViolationError);
});

test("read operations pass through unaffected", async () => {
  const client = createReadOnlyPrismaClient(new PrismaClient());
  const count = await client.user.count();
  assert.equal(typeof count, "number");
  await client.$disconnect();
});
