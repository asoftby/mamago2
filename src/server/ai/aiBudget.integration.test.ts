import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { AiBudgetExceededError, withAiBudget } from "./aiBudget";

async function main() {
  const marker = randomUUID();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let providerCalls = 0;

  try {
    const attempts = Array.from({ length: 20 }, async () => {
      try {
        await withAiBudget({
          principal: {
            userId: `test-user-${marker}`,
            accountScope: `test-business-${marker}`,
            accountScopeKind: "business",
          },
          endpoint: "detect-category",
          operation: async () => {
            providerCalls += 1;
            await gate;
          },
        });
        return true;
      } catch (error) {
        if (error instanceof AiBudgetExceededError) return false;
        throw error;
      }
    });

    while (providerCalls < 2) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(providerCalls, 2, "only the user concurrency ceiling may reach the provider");
    release();
    const results = await Promise.all(attempts);
    assert.equal(results.filter(Boolean).length, 2);
    console.log("AI PostgreSQL concurrency reservation test: OK");
  } finally {
    release?.();
    await prisma.rateLimitEntry.deleteMany({ where: { key: { startsWith: "ai:" } } });
    await prisma.$disconnect();
  }
}

void main();
