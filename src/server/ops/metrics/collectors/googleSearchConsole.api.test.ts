import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPairSync, createVerify } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { buildServiceAccountAssertion, collectGoogleSearchConsoleMetrics, dailyAggregate, gscPropertyKey, gscRequest, querySearchAnalytics, validProperty, type GscConfig } from "./googleSearchConsole";
import { getGscAnalytics } from "@/lib/admin/seo/data/gscAnalytics";

const config: GscConfig = { siteUrl: "sc-domain:example.com", clientEmail: "reader@example.iam.gserviceaccount.com", privateKey: "never-used" };
const range = { startDate: "2026-10-01", endDate: "2026-10-01" };
const row = { clicks: 10, impressions: 100, ctr: 0.1, position: 3 };
const originalFetch = globalThis.fetch;

test("direct GSC contracts (no database or Google credentials)", async (t) => {
  t.after(() => { globalThis.fetch = originalFetch; });
  await t.test("property validation and readonly signed JWT", () => {
    assert.ok(validProperty("https://example.com/path/"));
    for (const property of ["sc-domain:", "sc-domain:../evil", "https://user:password@example.com/", "https://example.com/?secret=x"]) assert.equal(validProperty(property), false);
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwt = buildServiceAccountAssertion({ ...config, privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString() }, new Date("2026-10-01T12:00:00Z"));
    const [header, payload, signature] = jwt.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    assert.equal(claims.scope, "https://www.googleapis.com/auth/webmasters.readonly");
    assert.equal(claims.exp - claims.iat, 3600);
    assert.equal(claims.sub, undefined);
    const verifier = createVerify("RSA-SHA256"); verifier.update(`${header}.${payload}`);
    assert.ok(verifier.verify(publicKey, signature, "base64url"));
  });
  await t.test("429/503/quota retry, Retry-After and permanent errors", async () => {
    let calls = 0;
    const delays: number[] = [];
    globalThis.fetch = async () => ++calls < 3 ? new Response("secret-upstream-body", { status: calls === 1 ? 429 : 503, headers: { "retry-after": "1" } }) : Response.json({ ok: true });
    await gscRequest("https://example.com", {}, Date.now() + 5000, async (ms) => { delays.push(ms); });
    assert.equal(calls, 3); assert.deepEqual(delays, [1000, 1000]);
    calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ error: { errors: [{ reason: "userRateLimitExceeded" }] } }, { status: 403 }); };
    await assert.rejects(gscRequest("https://example.com", {}, Date.now() + 5000, async () => {}), /HTTP 403/);
    assert.equal(calls, 3);
    for (const status of [400, 401, 403]) {
      calls = 0;
      globalThis.fetch = async () => { calls++; return new Response("secret-upstream-body", { status }); };
      await assert.rejects(gscRequest("https://example.com", {}), new RegExp(`^Error: GSC request failed with HTTP ${status}$`));
      assert.equal(calls, 1);
    }
    globalThis.fetch = async () => new Response("", { status: 429, headers: { "retry-after": "600" } });
    await assert.rejects(gscRequest("https://example.com", {}), /deferred/);
    await assert.rejects(gscRequest("https://example.com", {}, Date.now() - 1), /deadline/);
  });
  await t.test("network failure is bounded and redacted", async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("private token"); };
    await assert.rejects(gscRequest("https://example.com", {}, Date.now() + 5000, async () => {}), /^Error: GSC network request failed$/);
    assert.equal(calls, 3);
  });
  await t.test("persistent cache isolates property, range, dimensions and page; upsert is idempotent", async () => {
    const store = new Map<string, { rows: unknown; expiresAt: Date }>();
    const cache = {
      findUnique: async ({ where }: { where: { id: string } }) => store.get(where.id) ?? null,
      upsert: async ({ where, create }: { where: { id: string }; create: { rows: unknown; expiresAt: Date } }) => { store.set(where.id, create); },
    } as unknown as NonNullable<GscConfig["cache"]>;
    const cachedConfig = { ...config, cache };
    let calls = 0;
    globalThis.fetch = async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.dataState, "final");
      assert.equal(body.type, "web");
      return Response.json({ rows: [{ ...row, ...(body.dimensions.length ? { keys: ["/a"] } : {}) }] });
    };
    await querySearchAnalytics(cachedConfig, "token", range);
    await querySearchAnalytics(cachedConfig, "token", range);
    assert.equal(calls, 1);
    await querySearchAnalytics({ ...cachedConfig, siteUrl: "sc-domain:other.com" }, "token", range);
    await querySearchAnalytics(cachedConfig, "token", { startDate: "2026-10-02", endDate: "2026-10-02" });
    await querySearchAnalytics(cachedConfig, "token", range, ["page"], 25_000);
    await querySearchAnalytics(cachedConfig, "token", range, ["page"], 25_000, 25_000);
    assert.equal(store.size, 5);
    for (const value of store.values()) value.expiresAt = new Date(0);
    await querySearchAnalytics(cachedConfig, "token", range);
    assert.equal(store.size, 5); assert.equal(calls, 6);
    globalThis.fetch = async () => Response.json({ rows: [{ clicks: "broken" }] });
    await assert.rejects(querySearchAnalytics(cachedConfig, "token", range, ["query"]), /malformed/);
    assert.equal(store.size, 5);
  });
  await t.test("dates, response validation and daily weighted metrics", async () => {
    await assert.rejects(querySearchAnalytics(config, "token", { startDate: "2026-02-30", endDate: "2026-03-01" }), /parameters/);
    await assert.rejects(querySearchAnalytics(config, "token", range, [], 25_001), /parameters/);
    let day = 0;
    globalThis.fetch = async () => Response.json({ rows: [{ clicks: ++day, impressions: day * 10, ctr: 0.1, position: day }] });
    const result = await dailyAggregate(config, "token", { startDate: "2026-10-01", endDate: "2026-10-02" });
    assert.equal(result.clicks, 3); assert.equal(result.ctr, 0.1); assert.equal(result.position, 50 / 30);
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return Response.json(body.startDate === body.endDate ? {} : { rows: [row] });
    };
    assert.deepEqual(await dailyAggregate(config, "token", { startDate: "2026-10-01", endDate: "2026-10-02" }), row);
    globalThis.fetch = async () => Response.json({});
    await assert.rejects(dailyAggregate(config, "token", range), /no aggregate/);
    for (const value of [{ rows: [null] }, { rows: [{ ...row, keys: [123] }] }]) {
      globalThis.fetch = async () => Response.json(value);
      await assert.rejects(querySearchAnalytics(config, "token", range, ["page"]), /malformed/);
    }
  });
  await t.test("admin reads one property batch, labels stale data and remains credential-free", async () => {
    const collectedAt = new Date("2026-10-01T12:00:00Z");
    const prisma = { metricSample: {
      findFirst: async ({ where }: { where: { dimKey: string } }) => { assert.equal(where.dimKey, gscPropertyKey(config.siteUrl)); return { collectedAt }; },
      findMany: async ({ where }: { where: { collectedAt: Date } }) => { assert.equal(where.collectedAt, collectedAt); return [
        { metric: "gsc.clicks_7d", dimKey: "", value: 10 }, { metric: "gsc.data_through", dimKey: "2026-09-28", value: 1 },
      ]; },
    } } as unknown as PrismaClient;
    const result = await getGscAnalytics(prisma, { GOOGLE_SEARCH_CONSOLE_ENABLED: "true", GOOGLE_SEARCH_CONSOLE_SITE_URL: config.siteUrl });
    assert.equal(result?.metrics?.clicks, 10); assert.equal(result?.stale, true);
    assert.equal(await getGscAnalytics(prisma, {}), null);
  });
  await t.test("full collector publishes a complete batch or rejects; restart reuses query cache", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const values = {
      GOOGLE_SEARCH_CONSOLE_ENABLED: "true", GOOGLE_SEARCH_CONSOLE_SITE_URL: config.siteUrl,
      GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL: config.clientEmail,
      GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    };
    const prior = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
    Object.assign(process.env, values);
    try {
      const store = new Map<string, unknown>();
      const cache = {
        deleteMany: async () => ({ count: 0 }),
        findUnique: async ({ where }: { where: { id: string } }) => store.get(where.id) ?? null,
        upsert: async ({ where, create }: { where: { id: string }; create: unknown }) => { store.set(where.id, create); },
      };
      let analyticsCalls = 0;
      globalThis.fetch = async (url, init) => {
        if (String(url).includes("oauth2")) return Response.json({ access_token: "test-only-token" });
        analyticsCalls++;
        const body = JSON.parse(String(init?.body));
        return Response.json({ rows: [{ ...row, ...(body.dimensions.length ? { keys: ["https://example.com/a"] } : {}) }] });
      };
      const ctx = { prisma: { gscQueryCache: cache } as unknown as PrismaClient, now: new Date() };
      const first = await collectGoogleSearchConsoleMetrics(ctx);
      assert.equal(first.find((sample) => sample.metric === "gsc.clicks_7d")?.value, 70);
      assert.equal(first.find((sample) => sample.metric === "gsc.property")?.dimKey, gscPropertyKey(config.siteUrl));
      assert.equal(analyticsCalls, 17);
      assert.deepEqual(await collectGoogleSearchConsoleMetrics(ctx), first);
      assert.equal(analyticsCalls, 17);
      store.clear(); analyticsCalls = 0;
      globalThis.fetch = async (url) => {
        if (String(url).includes("oauth2")) return Response.json({ access_token: "test-only-token" });
        if (++analyticsCalls === 3) return new Response("private upstream body", { status: 403 });
        return Response.json({ rows: [row] });
      };
      await assert.rejects(collectGoogleSearchConsoleMetrics(ctx), /HTTP 403/);
      assert.equal(store.size, 2, "only completed requests are reusable after a failed cycle");
    } finally {
      for (const [key, value] of Object.entries(prior)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });

});
