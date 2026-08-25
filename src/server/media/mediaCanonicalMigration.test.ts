import assert from "node:assert/strict";
import { assertCanonicalEnvironment, parseCanonicalCliArgs } from "../../../scripts/data-migrations/backfill-media-canonical-names";
import { filterCanonicalRows, replaceJsonExact, type CanonicalPolicyRow } from "./mediaCanonicalMigration";

assert.deepEqual(parseCanonicalCliArgs([]), {
  apply: false, allowProduction: false, report: undefined, limit: undefined,
  mediaId: undefined, entityType: undefined, entityId: undefined,
});
assert.deepEqual(parseCanonicalCliArgs(["--apply", "--allow-production", "--limit", "2", "--entity-type", "route", "--entity-id", "r1"]), {
  apply: true, allowProduction: true, limit: 2, entityType: "ROUTE", entityId: "r1", report: undefined, mediaId: undefined,
});
assert.throws(() => parseCanonicalCliArgs(["--apply", "--dry-run"]), /Choose either/);
assert.throws(() => parseCanonicalCliArgs(["--limit", "0"]), /positive integer/);
assert.throws(() => parseCanonicalCliArgs(["--entity-type", "user"]), /Unsupported/);

const oldAppEnv = process.env.APP_ENV;
process.env.APP_ENV = "production";
assert.throws(() => assertCanonicalEnvironment({
  databaseUrl: "postgresql://x:x@127.0.0.1:9999/prodmamago",
  currentDatabase: "prodmamago", apply: true, allowProduction: false,
}), /--allow-production/);
assert.equal(assertCanonicalEnvironment({
  databaseUrl: "postgresql://x:x@127.0.0.1:9999/prodmamago",
  currentDatabase: "prodmamago", apply: true, allowProduction: true,
}).production, true);
process.env.APP_ENV = "local";
assert.throws(() => assertCanonicalEnvironment({
  databaseUrl: "postgresql://x:x@localhost:5433/mamago2",
  currentDatabase: "mamago2", apply: true, allowProduction: true,
}), /non-production/);
if (oldAppEnv === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = oldAppEnv;

const fake = (mediaId: string, entityType: string, entityId: string) => ({ mediaId, entityType, entityId }) as CanonicalPolicyRow;
assert.deepEqual(filterCanonicalRows([fake("m1", "ARTICLE", "a1"), fake("m2", "ROUTE", "r1")], { entityType: "ROUTE" }).map((row) => row.mediaId), ["m2"]);
assert.deepEqual(replaceJsonExact({ image: "/old", nested: ["/old", "/other"] }, "/old", "/new"), {
  image: "/new", nested: ["/new", "/other"],
});
console.log("mediaCanonicalMigration.test.ts: OK");
