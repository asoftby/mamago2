import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./directMessage.service.ts", import.meta.url), "utf8");

test("all Direct senders lock the thread and recheck status before inserting", () => {
  const transaction = source.slice(source.indexOf("const message = await prisma.$transaction("));
  const business = transaction.indexOf("if (input.senderType === DirectActorType.BUSINESS)");
  const others = transaction.indexOf("if (input.senderType !== DirectActorType.BUSINESS)");
  const insert = transaction.indexOf("const created = await tx.directMessage.create(");
  assert.ok(business >= 0 && others > business && insert > others);
  const businessSection = transaction.slice(business, others);
  const otherSection = transaction.slice(others, insert);
  for (const section of [businessSection, otherSection]) {
    assert.match(section, /FOR UPDATE/);
    assert.match(section, /tx\\.directThread\\.findUnique/);
  }
  assert.match(otherSection, /DirectThreadStatus\\.BLOCKED/);
  assert.match(otherSection, /DirectThreadStatus\\.ARCHIVED/);
});
