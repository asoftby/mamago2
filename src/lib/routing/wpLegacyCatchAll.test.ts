/** Unmapped URLs reach route resolution; verified manifest redirects stay in next.config.ts. */
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";

const previous = { APP_ENV: process.env.APP_ENV, SITE_INDEXING_ENABLED: process.env.SITE_INDEXING_ENABLED };
async function run() {
  // Next's test utilities expect the Node runtime global installed by its server.
  Object.assign(globalThis, { AsyncLocalStorage });
  const { NextRequest } = await import("next/server");
  const { proxy, config } = await import("../../proxy");
  const { unstable_doesMiddlewareMatch } = await import("next/experimental/testing/server");
  try {
    for (const pathname of ["/routes/example", "/admin", "/business", "/me", "/minsk/events/"]) {
      assert.equal(unstable_doesMiddlewareMatch({ config, url: `https://mamago.by${pathname}` }), true);
    }
    for (const pathname of ["/api/health", "/_next/static/test.js", "/_next/image", "/robots.txt", "/sitemap.xml", "/images/test.png"]) {
      assert.equal(unstable_doesMiddlewareMatch({ config, url: `https://mamago.by${pathname}` }), false);
    }
    process.env.APP_ENV = "production";
    process.env.SITE_INDEXING_ENABLED = "true";
    for (const path of [
      "/seo-audit-nonexistent-20261022", "/unknown-city-seo/events", "/new-city/events",
      "/minsk/events/missing", "/minsk", "/minsk/events", "/routes/marshrut-mogilev",
      "/me", "/business", "/admin", "/api/health",
    ]) {
      const response = await proxy(new NextRequest(`https://mamago.by${path}`));
      assert.equal(response.headers.get("location"), null, `${path} must not redirect to an unrelated hub`);
      assert.equal(response.headers.get("x-middleware-next"), "1", `${path} must reach its route`);
      if (["/me", "/business", "/admin"].includes(path)) {
        assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/, `${path} remains private`);
      }
    }
    const slash = await proxy(new NextRequest("https://mamago.by/minsk/events/"));
    assert.equal(slash.status, 301);
    assert.equal(slash.headers.get("location"), "https://mamago.by/minsk/events");
    for (const [host, path, expected] of [
      ["business.mamago.by", "/dashboard", "/business/dashboard"],
      ["admin.mamago.by", "/ranking", "/admin/ranking"],
    ]) {
      const response = await proxy(new NextRequest(`https://${host}${path}`, { headers: { host } }));
      assert.equal(response.headers.get("x-middleware-rewrite"), `https://${host}${expected}`);
      assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
    }
    process.env.APP_ENV = "dev";
    const dev = await proxy(new NextRequest("https://dev.mamago.by/minsk/events"));
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
