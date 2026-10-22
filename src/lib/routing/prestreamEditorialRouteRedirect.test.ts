import assert from "node:assert/strict";
import { LEGACY_EDITORIAL_ROUTE_SLUGS } from "../routes/legacyEditorialRouteCutover";
import { resolvePrestreamEditorialRouteLocation as decide } from "./prestreamEditorialRouteRedirect";

async function run() {
  for (const slug of LEGACY_EDITORIAL_ROUTE_SLUGS) {
    let checks = 0;
    for (const path of ["/routes/" + slug, "/routes/" + slug + "/"]) {
      const result = await decide(
        { pathname: path, search: "?utm_source=old&x=1", origin: "https://dev.mamago.by", method: "GET" },
        async (actual) => { checks++; assert.equal(actual, slug); return "/minsk/blog/" + slug; },
      );
      assert.equal(result, "https://dev.mamago.by/minsk/blog/" + slug + "?utm_source=old&x=1");
    }
    assert.equal(checks, 2);
  }
  for (const pathname of [
    "/routes/marshrut-mogilev",
    "/routes/unknown-route",
    "/routes/5-mini-puteshestvij-na-1-den-nedaleko-ot-minska/nested",
  ]) {
    assert.equal(await decide(
      { pathname, search: "", origin: "https://mamago.by", method: "GET" },
      async () => { throw new Error("Unexpected DB lookup"); },
    ), null);
  }
  const slug = LEGACY_EDITORIAL_ROUTE_SLUGS[0];
  for (const method of ["POST", "PUT", "DELETE"]) {
    assert.equal(await decide(
      { pathname: "/routes/" + slug, search: "", origin: "https://mamago.by", method },
      async () => { throw new Error("Unexpected DB lookup"); },
    ), null);
  }
  assert.equal(await decide(
    { pathname: "/routes/" + slug, search: "", origin: "https://mamago.by", method: "HEAD" },
    async () => null,
  ), null, "Unready Article cannot redirect");
  assert.equal(await decide(
    { pathname: "/routes/" + slug, search: "", origin: "https://mamago.by", method: "GET" },
    async () => { throw new Error("Database unavailable"); },
  ), null, "Database failure cannot produce a redirect");
  console.log("prestreamEditorialRouteRedirect.test.ts: PASS");
}
void run().catch((error) => { console.error(error); process.exitCode = 1; });
