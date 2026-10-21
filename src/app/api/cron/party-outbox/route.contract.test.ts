import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { authorizeCronRequest } from "@/server/cron/authorizeCron";

const src = readFileSync("src/app/api/cron/party-outbox/route.ts", "utf8");

// The route must authorize before touching any service.
const authAt = src.indexOf("authorizeCronRequest(request.headers.get(\"authorization\"))");
assert.ok(authAt > 0, "route must call authorizeCronRequest with the Authorization header");
assert.ok(src.indexOf("if (rejected) return rejected;") > authAt);
assert.ok(src.indexOf("expirePartyRequests()") > authAt, "expiry must run only after auth");
assert.ok(src.indexOf("dispatchPartyOutbox()") > authAt, "dispatch must run only after auth");

// Production: secret is mandatory, Bearer must match.
const prod = { NODE_ENV: "production" };
assert.equal(authorizeCronRequest(null, prod)?.status, 503);
assert.equal(authorizeCronRequest("Bearer anything", prod)?.status, 503);
assert.equal(authorizeCronRequest(null, { ...prod, CRON_SECRET: "s" })?.status, 401);
assert.equal(authorizeCronRequest("Bearer wrong", { ...prod, CRON_SECRET: "s" })?.status, 401);
assert.equal(authorizeCronRequest("s", { ...prod, CRON_SECRET: "s" })?.status, 401);
assert.equal(authorizeCronRequest("Bearer s", { ...prod, CRON_SECRET: "s" }), null);
// Non-production with a configured secret is enforced as well.
assert.equal(authorizeCronRequest(null, { CRON_SECRET: "s" })?.status, 401);
