import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routes = [
  "src/app/api/ai/rewrite/route.ts",
  "src/app/api/ai/detect-category/route.ts",
  "src/app/api/ai/enrich-event/route.ts",
];

for (const route of routes) {
  const source = readFileSync(resolve(process.cwd(), route), "utf8");
  assert.match(source, /resolveAiBudgetPrincipal/);
  assert.match(source, /withAiBudget/);
  assert.match(source, /AiBudgetExceededError/);
}

console.log("AI endpoint shared-budget wiring tests: OK");
