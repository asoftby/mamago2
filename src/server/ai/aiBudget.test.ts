import assert from "node:assert/strict";
import {
  AiBudgetExceededError,
  createAiBudgetController,
  type AiBudgetCounterStore,
  type AiBudgetPrincipal,
  type PaidAiEndpoint,
} from "./aiBudget";

function memoryStore() {
  const counters = new Map<string, { count: number; resetAt: number }>();
  const store: AiBudgetCounterStore = {
    reserve: async (reservations, now) => {
      const proposed = new Map<string, { count: number; resetAt: number }>();
      for (const reservation of reservations) {
        const current = proposed.get(reservation.key) ?? counters.get(reservation.key);
        const count = !current || current.resetAt <= now.getTime()
          ? reservation.amount
          : current.count + reservation.amount;
        const resetAt = !current || current.resetAt <= now.getTime()
          ? now.getTime() + reservation.windowMs
          : current.resetAt;
        if (count > reservation.limit) throw new AiBudgetExceededError(reservation.event);
        proposed.set(reservation.key, { count, resetAt });
      }
      for (const [key, value] of proposed) counters.set(key, value);
    },
    releaseInflight: async (reservations, now) => {
      for (const reservation of reservations.filter((item) => item.inflight)) {
        const current = counters.get(reservation.key);
        if (current && current.resetAt > now.getTime()) {
          current.count = Math.max(0, current.count - reservation.amount);
        }
      }
    },
  };
  return { store, counters };
}

function principal(userId: string, accountScope = "business-a"): AiBudgetPrincipal {
  return { userId, accountScope, accountScopeKind: "business" };
}

async function accepted(
  withBudget: ReturnType<typeof createAiBudgetController>,
  actor: AiBudgetPrincipal,
  endpoint: PaidAiEndpoint,
  operation: () => Promise<void> = async () => undefined,
) {
  try {
    await withBudget({ principal: actor, endpoint, operation });
    return true;
  } catch (error) {
    if (error instanceof AiBudgetExceededError) return false;
    throw error;
  }
}

async function testEndpointRotationSharesDailyBudget() {
  const { store } = memoryStore();
  let now = new Date("2026-09-22T00:00:00.000Z");
  const withBudget = createAiBudgetController(store, () => now);
  const actor = principal("rotation-user");
  const endpoints: PaidAiEndpoint[] = ["rewrite", "detect-category", "enrich-event"];
  let providerCalls = 0;

  for (let index = 0; index < 28; index += 1) {
    now = new Date(now.getTime() + 61_000);
    const ok = await accepted(withBudget, actor, endpoints[index % endpoints.length], async () => {
      providerCalls += 1;
    });
    if (!ok) break;
  }
  assert.equal(providerCalls, 27);
  assert.equal(await accepted(withBudget, actor, "rewrite"), false);
}

async function testUserLimitDoesNotBecomeMembershipLimit() {
  const { store } = memoryStore();
  const withBudget = createAiBudgetController(store);
  let calls = 0;
  for (let index = 0; index < 11; index += 1) {
    await accepted(withBudget, principal("user-a"), "detect-category", async () => { calls += 1; });
  }
  assert.equal(calls, 10);
  assert.equal(await accepted(withBudget, principal("user-b"), "detect-category"), true);
}

async function testBusinessSharedAcrossMembers() {
  const { store } = memoryStore();
  const withBudget = createAiBudgetController(store);
  let calls = 0;
  for (let index = 0; index < 32; index += 1) {
    await accepted(withBudget, principal(`member-${index % 4}`, "shared-business"), "detect-category", async () => { calls += 1; });
  }
  assert.equal(calls, 30);
}

async function testCrossBusinessScopes() {
  const { store } = memoryStore();
  const withBudget = createAiBudgetController(store);
  let calls = 0;
  for (let index = 0; index < 11; index += 1) {
    const scope = index % 2 === 0 ? "business-a" : "business-b";
    await accepted(withBudget, principal("same-user", scope), "detect-category", async () => { calls += 1; });
  }
  assert.equal(calls, 10, "user budget must remain shared across businesses");
  assert.equal(await accepted(withBudget, principal("other-user", "business-b"), "detect-category"), true);
}

async function testGlobalBudget() {
  const { store } = memoryStore();
  const withBudget = createAiBudgetController(store);
  let calls = 0;
  for (let index = 0; index < 205; index += 1) {
    await accepted(
      withBudget,
      principal(`global-user-${index}`, `global-business-${index}`),
      "detect-category",
      async () => { calls += 1; },
    );
  }
  assert.equal(calls, 200);
}

async function testConcurrencyReservation() {
  const { store } = memoryStore();
  const withBudget = createAiBudgetController(store);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let providerCalls = 0;

  const attempts = Array.from({ length: 20 }, () =>
    accepted(withBudget, principal("concurrent-user"), "detect-category", async () => {
      providerCalls += 1;
      await gate;
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(providerCalls, 2);
  release();
  const results = await Promise.all(attempts);
  assert.equal(results.filter(Boolean).length, 2);
}

async function testProviderFailureKeepsSpendReservation() {
  const { store, counters } = memoryStore();
  const withBudget = createAiBudgetController(store);
  await assert.rejects(
    withBudget({
      principal: principal("failure-user"),
      endpoint: "rewrite",
      operation: async () => { throw new Error("timeout"); },
    }),
    /timeout/,
  );
  const dailyUserCounters = [...counters.entries()].filter(([key]) => key.startsWith("ai:user:units:day:"));
  assert.equal(dailyUserCounters[0]?.[1].count, 10_000);
  const inflightCounters = [...counters.entries()].filter(([key]) => key.includes(":inflight:"));
  assert.ok(inflightCounters.every(([, value]) => value.count === 0));
}

async function main() {
  await testEndpointRotationSharesDailyBudget();
  await testUserLimitDoesNotBecomeMembershipLimit();
  await testBusinessSharedAcrossMembers();
  await testCrossBusinessScopes();
  await testGlobalBudget();
  await testConcurrencyReservation();
  await testProviderFailureKeepsSpendReservation();
  console.log("AI shared budget tests: OK");
}

void main();
