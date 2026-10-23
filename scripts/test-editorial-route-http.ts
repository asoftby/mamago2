/** Built-app HTTP gate. Only a fresh, explicitly named loopback synthetic DB is accepted. */
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { existsSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { PrismaClient, type Prisma } from "@prisma/client";
import { LEGACY_EDITORIAL_ROUTE_SLUGS as slugs } from "../src/lib/routes/legacyEditorialRouteCutover";

const url = new URL(process.env.DATABASE_URL ?? "");
assert.equal(url.hostname, "127.0.0.1", "Only loopback synthetic PostgreSQL is permitted");
assert.equal(url.pathname, "/seo_redirect_test");
assert.equal(url.username, "seo_redirect_test");
assert.equal(url.password, "synthetic_only");
assert.equal(url.search, "", "No schema/host overrides");
assert.equal(url.protocol, "postgresql:");
for (const file of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  assert.ok(!existsSync(file), `Run in an isolated worktree without ${file}`);
}
const db = new PrismaClient();
const evidence: object[] = [];
let app: ChildProcess | undefined;
let appLog = "";
let base = "";
let environment = "";
let migrated = false;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function stopApp() {
  if (!app || app.exitCode !== null || app.signalCode !== null) return;
  const exited = once(app, "exit");
  app.kill("SIGTERM");
  const timer = setTimeout(() => app?.kill("SIGKILL"), 5000);
  try { await exited; } finally { clearTimeout(timer); }
}

async function startApp(mode: string, outage = false) {
  await stopApp();
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const address = socket.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve) => socket.close(() => resolve()));
  base = `http://127.0.0.1:${port}`;
  environment = outage ? `${mode}-db-unavailable` : mode;
  appLog = "";
  const badUrl = new URL(url);
  badUrl.port = "1";
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: {
      ...process.env, NODE_ENV: "production", APP_ENV: mode,
      DATABASE_URL: outage ? badUrl.toString() : url.toString(),
      APP_PUBLIC_URL: mode === "production" ? "https://mamago.by" : "https://dev.mamago.by",
      SITE_INDEXING_ENABLED: "true", SITE_NOINDEX_FORCE: "false", SITE_NOINDEX_DEFAULT: "false",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  app.stdout?.on("data", (chunk) => { appLog += String(chunk); });
  app.stderr?.on("data", (chunk) => { appLog += String(chunk); });
  for (let i = 0; i < 120; i++) {
    assert.equal(app.exitCode, null, `Next exited: ${appLog}`);
    try {
      const response = await fetch(`${base}/robots.txt`, { signal: AbortSignal.timeout(2000) });
      if (response.status === 200) return;
    } catch { /* bounded startup wait */ }
    await wait(250);
  }
  throw new Error(`Next not ready: ${appLog}`);
}

async function request(path: string, method = "GET") {
  const response = await fetch(base + path, { method, redirect: "manual", signal: AbortSignal.timeout(30000) });
  const body = await response.text();
  const row = { environment, path, method, status: response.status, location: response.headers.get("location"), robots: response.headers.get("x-robots-tag") };
  evidence.push(row);
  return { response, body, ...row };
}

async function assertReady(mode: string) {
  for (const slug of slugs) {
    for (const method of ["GET", "HEAD"]) {
      for (const slash of ["", "/"]) {
        const query = "?utm_source=legacy&x=1&x=2&q=%D0%BC%D0%B8%D0%BD%D1%81%D0%BA";
        const result = await request(`/routes/${slug}${slash}${query}`, method);
        assert.equal(result.status, 308, JSON.stringify(result));
        assert.ok(result.location);
        // Next.js serializes same-origin Location as a relative reference.
        // Resolve per HTTP semantics, then compare the entire origin/path/query.
        assert.equal(new URL(result.location, base).href, `${base}/minsk/blog/${slug}${query}`);
        assert.equal(result.robots, mode === "production" ? null : "noindex, nofollow");
        assert.equal(result.response.headers.get("link"), null, "Redirect must not emit an unrelated canonical");
        assert.equal(result.body, method === "HEAD" ? "" : result.location, "Only Next's plain redirect text, no rendered page/meta refresh");
      }
    }
    const target = await request(`/minsk/blog/${slug}`);
    assert.equal(target.status, 200);
    assert.ok(!target.body.includes("NEXT_HTTP_ERROR_FALLBACK"), `Target failed: ${slug}`);
    const origin = mode === "production" ? "https://mamago.by" : "https://dev.mamago.by";
    assert.ok(target.body.includes(`href="${origin}/minsk/blog/${slug}"`), `Self canonical missing: ${slug}`);
    const canonicals = target.body.match(/<link[^>]+rel="canonical"[^>]*>/g) ?? [];
    assert.equal(canonicals.length, 1, `One canonical required: ${slug}`);
    assert.ok(target.body.includes("Synthetic editorial HTTP integration content."));
    const robots = [...target.body.matchAll(/<meta name="robots" content="([^"]+)"/g)].map((match) => match[1]);
    if (mode !== "production") {
      assert.equal(target.robots, "noindex, nofollow");
      assert.ok(robots.some((value) => value.includes("noindex")), "DEV meta robots stays closed");
    } else {
      assert.ok(!robots.some((value) => value.includes("noindex")), "PROD Article remains indexable");
    }
  }
}

async function assertNotRedirected(label: string, slug: string) {
  for (const method of ["GET", "HEAD"]) {
    const result = await request(`/routes/${slug}`, method);
    assert.notEqual(result.status, 308, label);
    assert.equal(result.location, null, label);
    assert.ok(!result.body.includes('http-equiv="refresh"'), `No streamed redirect either: ${label}`);
  }
}

async function main() {
  // Identity + readiness before any migration or synthetic write.
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try { await db.$queryRaw`SELECT 1`; ready = true; break; } catch { await wait(1000); }
  }
  assert.ok(ready, "Synthetic PostgreSQL must be ready");
  const [identity] = await db.$queryRaw<{ database: string; username: string }[]>`SELECT current_database() AS database, current_user AS username`;
  assert.deepEqual(identity, { database: "seo_redirect_test", username: "seo_redirect_test" });
  const tables = await db.$queryRaw<{ name: string }[]>`SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public'`;
  assert.equal(tables.length, 0, "Gate requires a fresh disposable database, never an existing application DB");
  const migration = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], { stdio: "inherit", env: process.env });
  assert.equal(migration.status, 0, "Apply repository migrations to synthetic DB");
  migrated = true;
  // Repository migrations seed the BY reference country even in an empty DB.
  const country = await db.country.upsert({
    where: { isoCode: "BY" },
    update: { name: "Synthetic country", isActive: true },
    create: { name: "Synthetic country", slug: "synthetic-country", isoCode: "BY", isActive: true },
  });
  const city = await db.city.create({ data: { name: "Минск", slug: "minsk", countryId: country.id } });
  const otherCity = await db.city.create({ data: { name: "Synthetic other city", slug: "synthetic-other-city", countryId: country.id } });
  const category = await db.eventCategory.create({ data: { nameRu: "Маршруты", nameEn: "Synthetic routes", slug: "marshruty", publicationType: "ARTICLE" } });
  for (const slug of [...slugs, "marshrut-mogilev", "synthetic-unapproved"]) {
    await db.route.create({ data: { slug, title: `Synthetic ${slug}`, ageTags: [], status: "ARCHIVED", cityId: city.id } });
    await db.article.create({ data: {
      slug, title: `Synthetic ${slug}`, status: "PUBLISHED", geoScope: "CITY", cityId: city.id,
      categoryId: category.id, publishedAt: new Date("2026-01-01T00:00:00Z"),
      contentJson: { version: 1, blocks: [{ id: "synthetic-text", type: "text", text: "Synthetic editorial HTTP integration content." }] },
    } });
  }
  await startApp("production");
  await assertReady("production");
  await assertNotRedirected("Excluded Mogilev even with ready data", "marshrut-mogilev");
  await assertNotRedirected("Unapproved ready data", "synthetic-unapproved");
  await assertNotRedirected("Unknown route", "synthetic-missing");

  const slug = slugs[0];
  const article = await db.article.findFirstOrThrow({ where: { slug } });
  for (const data of [
    { status: "DRAFT" }, { contentJson: { version: 1, blocks: [] } }, { noindex: true }, { seoRobots: "NOINDEX, follow" },
    { geoScope: "COUNTRY", cityId: null }, { cityId: otherCity.id }, { categoryId: null },
  ] satisfies Prisma.ArticleUncheckedUpdateInput[]) {
    // Scalar city/category foreign keys use the unchecked update variant.
    await db.article.update({ where: { id: article.id }, data });
    await assertNotRedirected(`Unready Article ${JSON.stringify(data)}`, slug);
    await db.article.update({ where: { id: article.id }, data: {
      contentJson: article.contentJson ?? {}, status: "PUBLISHED", noindex: false, seoRobots: null, geoScope: "CITY", cityId: city.id, categoryId: category.id,
    } });
  }
  for (const data of [{ isActive: false }, { archivedAt: new Date() }, { nameRu: "Other" }, { publicationType: "EVENT" }] satisfies Prisma.EventCategoryUpdateInput[]) {
    await db.eventCategory.update({ where: { id: category.id }, data });
    await assertNotRedirected("Unready category", slug);
    await db.eventCategory.update({ where: { id: category.id }, data: { isActive: true, archivedAt: null, nameRu: "Маршруты", publicationType: "ARTICLE" } });
  }
  await db.country.update({ where: { id: country.id }, data: { isoCode: "ZZ" } });
  await assertNotRedirected("City outside the public country scope", slug);
  await db.country.update({ where: { id: country.id }, data: { isoCode: "BY" } });
  await db.city.update({ where: { id: city.id }, data: { isLegacyNonCity: true } });
  await assertNotRedirected("Legacy non-city", slug);
  await db.city.update({ where: { id: city.id }, data: { isLegacyNonCity: false } });
  await db.city.update({ where: { id: city.id }, data: { isActive: false } });
  await assertNotRedirected("Inactive city", slug);
  await db.city.update({ where: { id: city.id }, data: { isActive: true } });
  await db.route.update({ where: { slug }, data: { status: "DRAFT" } });
  await assertNotRedirected("Source not archived", slug);
  await db.route.update({ where: { slug }, data: { status: "ARCHIVED" } });
  const author = await db.user.create({ data: { email: "synthetic-route-author@example.invalid" } });
  await db.route.update({ where: { slug }, data: { authorId: author.id } });
  await assertNotRedirected("User-authored source with approved slug", slug);
  await db.route.update({ where: { slug }, data: { authorId: null } });
  await db.route.create({ data: { slug: "synthetic-public-ugc", title: "Synthetic public UGC", ageTags: [], status: "PUBLISHED", visibility: "PUBLIC", authorId: author.id, cityId: city.id } });
  const ugc = await request("/routes/synthetic-public-ugc");
  assert.equal(ugc.status, 200);
  assert.equal(ugc.location, null);
  assert.ok(ugc.body.includes("Synthetic public UGC"));
  await db.article.delete({ where: { id: article.id } });
  await assertNotRedirected("Missing Article", slug);
  await db.article.create({ data: {
    slug, title: article.title, status: "PUBLISHED", geoScope: "CITY",
    cityId: city.id, categoryId: category.id, publishedAt: article.publishedAt,
    contentJson: article.contentJson as Prisma.InputJsonValue,
  } });

  for (const path of ["/me", "/admin", "/business"]) {
    const result = await request(path);
    assert.equal(result.robots, "noindex, nofollow", `${path} stays private`);
    assert.ok([200, 307].includes(result.status), `${path} auth response: ${result.status}`);
    const refresh = result.body.match(/<meta[^>]*http-equiv="refresh"[^>]*>/)?.[0];
    const destination = result.location ?? refresh?.match(/content="[01];url=([^"]+)"/)?.[1];
    assert.ok(destination, `${path} must issue an actual auth redirect, including streamed redirects`);
    const login = new URL(destination.replaceAll("&amp;", "&"), base);
    assert.equal(login.pathname, "/login");
    assert.equal(login.searchParams.get("redirectTo"), path, "Proxy preserves auth return path");
  }
  const api = await request("/api/health");
  assert.equal(api.status, 200);
  assert.equal(api.location, null);
  const trailing = await request("/minsk/events/");
  assert.equal(trailing.status, 301);
  assert.ok(trailing.location);
  assert.equal(new URL(trailing.location, base).href, `${base}/minsk/events`);
  const manifest = await request("/birthday");
  assert.equal(manifest.status, 308);
  assert.equal(new URL(manifest.location!, base).pathname, "/minsk/birthday/make");

  // Same immutable build, different runtime indexing policy.
  for (const mode of ["dev", "staging", "test"]) {
    await startApp(mode);
    await assertReady(mode);
    const robots = await request("/robots.txt");
    assert.ok(robots.body.includes("Disallow: /"));
  }
  await startApp("production", true);
  await assertNotRedirected("Database unreachable", slug);
  assert.ok(appLog.includes("[editorial-route-redirect] Readiness lookup failed"), "DB failure is observable");
  console.log(JSON.stringify({ result: "PASS", approvedRoutes: slugs.length, assertions: evidence }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await stopApp();
  // Reset only the schema that this process verified empty and then migrated.
  if (migrated) {
    await db.$executeRawUnsafe('DROP SCHEMA public CASCADE');
    await db.$executeRawUnsafe('CREATE SCHEMA public');
  }
  await db.$disconnect();
  writeFileSync("/tmp/mamago-editorial-http-evidence.json", JSON.stringify(evidence, null, 2));
});
