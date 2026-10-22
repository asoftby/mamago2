/** Unmapped URLs reach route resolution; verified manifest redirects stay in next.config.ts. */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";

const previous = { APP_ENV: process.env.APP_ENV, SITE_INDEXING_ENABLED: process.env.SITE_INDEXING_ENABLED };
async function run() {
try {
  process.env.APP_ENV = "production";
  process.env.SITE_INDEXING_ENABLED = "true";
  for (const path of [
    "/seo-audit-nonexistent-20261022", "/unknown-city-seo/events", "/new-city/events",
    "/minsk/events/missing", "/minsk", "/minsk/events", "/routes/marshrut-mogilev",
    "/me", "/business", "/admin", "/api/health",
  ]) {
    const response = await middleware(new NextRequest(`https://mamago.by${path}`));
    assert.equal(response.headers.get("location"), null, `${path} must not redirect to an unrelated hub`);
    assert.equal(response.headers.get("x-middleware-next"), "1", `${path} must reach its route`);
    if (["/me", "/business", "/admin"].includes(path)) {
      assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/, `${path} remains private`);
    }
  }
  const slash = await middleware(new NextRequest("https://mamago.by/minsk/events/"));
  assert.equal(slash.status, 301);
  assert.equal(slash.headers.get("location"), "https://mamago.by/minsk/events");
  process.env.APP_ENV = "dev";
  const dev = await middleware(new NextRequest("https://dev.mamago.by/minsk/events"));
  assert.match(dev.headers.get("x-robots-tag") ?? "", /noindex/);
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
console.log("Unmapped URL / private surfaces / DEV middleware regressions: OK");
}
void run().catch((error) => { console.error(error); process.exitCode = 1; });
