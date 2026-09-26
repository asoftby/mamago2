import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sharedTabs = readFileSync(
  new URL("./AdminFilterTabs.tsx", import.meta.url),
  "utf8",
);
const verification = readFileSync(
  new URL("../../../app/admin/b2b/requests/BusinessVerificationRequestsPage.tsx", import.meta.url),
  "utf8",
);
const accessRequests = readFileSync(
  new URL("../../../app/admin/b2b/access-requests/page.tsx", import.meta.url),
  "utf8",
);
const orders = readFileSync(
  new URL("../../../app/admin/orders/AdminOrdersClient.tsx", import.meta.url),
  "utf8",
);

assert.match(sharedTabs, /bg-stone-900 text-white/);
assert.match(sharedTabs, /overflow-x-auto/);
assert.match(sharedTabs, /count\?: number/);

for (const [name, source] of [
  ["business verification", verification],
  ["business access requests", accessRequests],
  ["orders", orders],
] as const) {
  assert.match(
    source,
    /AdminFilterTabs/,
    `${name} must use the shared AdminFilterTabs control`,
  );
}

assert.doesNotMatch(
  verification,
  /border-b-2 transition-colors whitespace-nowrap/,
  "verification must not keep its legacy underline status tabs",
);

assert.doesNotMatch(
  accessRequests,
  /border-b-2 transition-colors whitespace-nowrap/,
  "access requests must not keep its legacy underline status tabs",
);

assert.doesNotMatch(
  orders,
  /<label className="text-xs font-medium text-gray-600">Статус<\/label>/,
  "orders must not duplicate the top status control with a second status dropdown",
);

console.log("AdminFilterTabs contract tests: OK");
