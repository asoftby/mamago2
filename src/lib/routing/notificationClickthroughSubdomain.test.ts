import assert from "node:assert/strict";

import { resolveSubdomainMiddlewareDecision } from "./subdomainMiddleware";

const notificationPath = "/n/cmtvkxhux01ntnu01mgss0ar7";

for (const host of [
  "admin.mamago.by",
  "admin.dev.mamago.by",
  "admin.prod.mamago.by",
  "business.mamago.by",
  "business.dev.mamago.by",
  "business.prod.mamago.by",
]) {
  assert.deepEqual(
    resolveSubdomainMiddlewareDecision({
      host,
      protocol: "https:",
      pathname: notificationPath,
      search: "",
    }),
    { kind: "next" },
    `${host}${notificationPath} must reach the shared /n/[id] route`,
  );
}

for (const pathname of ["/n", "/n/", "/n/id/extra"]) {
  assert.deepEqual(
    resolveSubdomainMiddlewareDecision({
      host: "admin.mamago.by",
      protocol: "https:",
      pathname,
      search: "",
    }),
    { kind: "rewrite", pathname: `/admin${pathname}` },
    `${pathname} must not widen the shared-route allowlist`,
  );
}

console.log("notification click-through subdomain tests: OK");
