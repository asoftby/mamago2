/**
 * Runs scripts/ops/inbox-purge-smoke.ts as a child process against a scratch
 * Postgres, with the real purge route served on a local port.
 *   NODE_OPTIONS=--conditions=react-server tsx <this file>
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import test, { after, before } from "node:test";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

const SECRET = "smoke-test-secret-not-real";
const db = new PrismaClient();
const servers: Server[] = [];

async function serve(handler: (req: NextRequest) => Promise<Response> | Response): Promise<string> {
  const server = createServer(async (incoming, outgoing) => {
    const response = await handler(
      new NextRequest(`http://localhost${incoming.url}`, { headers: { authorization: incoming.headers.authorization ?? "" } }),
    );
    outgoing.statusCode = response.status;
    outgoing.setHeader("content-type", "application/json");
    outgoing.end(await response.text());
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  servers.push(server);
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

/** Async on purpose: the purge route is served from this very process, so it must stay responsive. */
function runSmoke(args: string[], env: Record<string, string | undefined> = {}): Promise<{ status: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", "scripts/ops/inbox-purge-smoke.ts", ...args], {
      cwd: new URL("../../../../../", import.meta.url).pathname,
      env: { ...process.env, CRON_SECRET: SECRET, ...env },
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += String(chunk)));
    child.stderr.on("data", (chunk) => (output += String(chunk)));
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("smoke script timed out"));
    }, 120_000);
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, output });
    });
  });
}

before(async () => {
  process.env.CRON_SECRET = SECRET;
});

after(async () => {
  for (const server of servers) server.close();
  await db.$disconnect();
});

async function leftovers(): Promise<number> {
  return db.user.count({ where: { id: { startsWith: "purge-smoke-" } } });
}

test("smoke PASSes against the real purge route and leaves nothing behind", async () => {
  const { GET } = await import("../../../../app/api/cron/inbox-purge/route");
  const baseUrl = await serve((req) => GET(req));
  const { status, output } = await runSmoke([`--base-url=${baseUrl}`]);
  assert.equal(status, 0, output);
  assert.match(output, /PURGE_SMOKE PASS items_created=6 checks=\d+ failed=0/);
  for (const name of ["purge_route_ok", "expired_parts_text_null", "expired_drafts_null", "old_item_deleted", "unexpired_control_untouched", "marker_not_found", "synthetic_rows_removed"]) {
    assert.match(output, new RegExp(`check ${name}: PASS`));
  }
  assert.ok(!output.includes("PURGE_SMOKE_"), "the marker is never printed");
  assert.ok(!output.includes(SECRET), "the secret is never printed");
  assert.equal(await leftovers(), 0);
});

test("smoke FAILs (exit 1) when the purge route does nothing, still cleaning up", async () => {
  const baseUrl = await serve(() => new Response("{}", { status: 200 }));
  const { status, output } = await runSmoke([`--base-url=${baseUrl}`]);
  assert.equal(status, 1, output);
  assert.match(output, /PURGE_SMOKE FAIL/);
  assert.match(output, /check expired_parts_text_null: FAIL/);
  assert.match(output, /check synthetic_rows_removed: PASS/);
  assert.equal(await leftovers(), 0);
});

test("smoke FAILs when the route rejects the call (wrong secret)", async () => {
  const { GET } = await import("../../../../app/api/cron/inbox-purge/route");
  const baseUrl = await serve((req) => GET(req));
  const { status, output } = await runSmoke([`--base-url=${baseUrl}`], { CRON_SECRET: "another-secret" });
  assert.equal(status, 1, output);
  assert.match(output, /check purge_route_ok: FAIL \(401\)/);
  assert.equal(await leftovers(), 0);
});

test("smoke refuses a non-local database host unless it is confirmed, and never connects", async () => {
  const url = "postgresql://user:hunter2@db.prod.example.com:5432/app";
  const refused = await runSmoke([], { DATABASE_URL: url });
  assert.equal(refused.status, 2, refused.output);
  assert.match(refused.output, /PURGE_SMOKE REFUSED: database host "db\.prod\.example\.com" is not local/);
  assert.ok(!refused.output.includes("hunter2") && !refused.output.includes("user:"), "credentials are never printed");

  const wrongConfirm = await runSmoke(["--confirm-host=other.example.com"], { DATABASE_URL: url });
  assert.equal(wrongConfirm.status, 2);
  assert.match(wrongConfirm.output, /REFUSED/);

  const missing = await runSmoke([], { DATABASE_URL: "" });
  assert.equal(missing.status, 2);
});
