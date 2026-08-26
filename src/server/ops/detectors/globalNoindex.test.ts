/**
 * global_noindex detector tests (§21 Step 4, Phase B).
 * Run: npx tsx src/server/ops/detectors/globalNoindex.test.ts
 */
import assert from "node:assert/strict";
import http from "node:http";

import {
  evaluateGlobalNoindex,
  htmlHasNoindexMeta,
  probeGlobalNoindex,
  robotsHasSiteWideDisallow,
  xRobotsTagHasNoindex,
  type GlobalNoindexProbe,
} from "./globalNoindex";
import type { DetectorContext } from "../types";

// ── robots.txt parser ───────────────────────────────────────────────────

assert.equal(
  robotsHasSiteWideDisallow("User-agent: *\nDisallow: /\n"),
  true,
  "wildcard + exact / must be CRITICAL",
);
assert.equal(
  robotsHasSiteWideDisallow("User-agent: *\nDisallow: /private\n"),
  false,
  "a scoped path must not false-positive",
);
assert.equal(
  robotsHasSiteWideDisallow("User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nAllow: /\n"),
  false,
  "a non-wildcard bot's site-wide block must not trigger; wildcard itself allows",
);
assert.equal(
  robotsHasSiteWideDisallow(`
    # comment line
    User-agent: *   # inline comment
    Disallow: /   # blocks everything
  `),
  true,
  "comments and whitespace must be tolerated",
);
assert.equal(
  robotsHasSiteWideDisallow("USER-AGENT: *\nDISALLOW: /\n"),
  true,
  "directive names must be case-insensitive",
);
assert.equal(
  robotsHasSiteWideDisallow(
    "User-agent: A\nDisallow: /a\n\nUser-agent: B\nUser-agent: *\nDisallow: /\n",
  ),
  true,
  "multiple groups: the group containing * still counts",
);
assert.equal(robotsHasSiteWideDisallow(""), false, "empty robots.txt -> no signal");
assert.equal(
  robotsHasSiteWideDisallow("User-agent: *\nAllow: /\n"),
  false,
  "no blocking directive -> no signal",
);

console.log("globalNoindex.test.ts (robots parser): OK");

// ── X-Robots-Tag parser ─────────────────────────────────────────────────

assert.equal(xRobotsTagHasNoindex("noindex"), true);
assert.equal(xRobotsTagHasNoindex("noindex, nofollow"), true);
assert.equal(xRobotsTagHasNoindex("index, follow"), false);
assert.equal(xRobotsTagHasNoindex("NoIndex"), true, "case-insensitive");
assert.equal(xRobotsTagHasNoindex(null), false);
assert.equal(xRobotsTagHasNoindex(""), false);

console.log("globalNoindex.test.ts (X-Robots-Tag parser): OK");

// ── HTML meta robots parser ─────────────────────────────────────────────

assert.equal(htmlHasNoindexMeta('<meta name="robots" content="noindex">'), true);
assert.equal(
  htmlHasNoindexMeta('<meta content="noindex" name="robots">'),
  true,
  "attribute order reversed",
);
assert.equal(
  htmlHasNoindexMeta('<meta name="robots" content="noindex, nofollow">'),
  true,
  "multiple directives",
);
assert.equal(htmlHasNoindexMeta('<meta name="robots" content="index,follow">'), false);
assert.equal(
  htmlHasNoindexMeta('<meta name="description" content="noindex is not a real description">'),
  false,
  "unrelated meta tag must not false-positive on its content text",
);
assert.equal(
  htmlHasNoindexMeta('<meta NAME="Robots" CONTENT="NOINDEX">'),
  true,
  "case variation in attribute names/values",
);
assert.equal(htmlHasNoindexMeta("<html><head></head><body></body></html>"), false);

console.log("globalNoindex.test.ts (meta parser): OK");

// ── evaluate() ───────────────────────────────────────────────────────────

function probe(overrides: Partial<GlobalNoindexProbe> = {}): GlobalNoindexProbe {
  return { robotsTxt: "User-agent: *\nAllow: /\n", homepageHtml: "<html></html>", homepageXRobotsTag: null, ...overrides };
}

assert.deepEqual(evaluateGlobalNoindex(probe()).signals, [], "healthy state -> no signal");
assert.equal(
  evaluateGlobalNoindex(probe({ robotsTxt: "User-agent: *\nDisallow: /\n" })).signals.length,
  1,
);
assert.equal(evaluateGlobalNoindex(probe({ homepageXRobotsTag: "noindex" })).signals.length, 1);
assert.equal(
  evaluateGlobalNoindex(probe({ homepageHtml: '<meta name="robots" content="noindex">' })).signals.length,
  1,
);
{
  const result = evaluateGlobalNoindex(probe({ homepageXRobotsTag: "noindex" }));
  assert.equal(result.signals[0].fingerprint, "seo.global_noindex:prod");
  assert.equal(result.signals[0].severity, "CRITICAL");
}

console.log("globalNoindex.test.ts (evaluate): OK");

// ── probe() against a controlled local HTTP server — failure semantics ──

async function testProbeFailureSemantics() {
  const server = http.createServer((req, res) => {
    if (req.url === "/robots.txt") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("User-agent: *\nAllow: /\n");
      return;
    }
    if (req.url === "/") {
      res.writeHead(500);
      res.end("error");
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to bind test server");

  process.env.APP_PUBLIC_URL = `http://127.0.0.1:${address.port}`;
  try {
    const ctx: DetectorContext = { prisma: {} as never, fetch, workerStartedAt: new Date() };
    await assert.rejects(
      () => probeGlobalNoindex(ctx),
      "a broken homepage (HTTP 500) must make probe() throw, not silently report 'healthy'",
    );
  } finally {
    delete process.env.APP_PUBLIC_URL;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

testProbeFailureSemantics().then(
  () => console.log("globalNoindex.test.ts (probe failure semantics): OK"),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

// ── probe() network error diagnostics ────────────────────────────────────

async function testProbeNetworkErrorDiagnostics() {
  // Nothing listens on this port — fetch fails at the transport level
  // (ECONNREFUSED), not with an HTTP status, exercising the
  // fetchIndexabilitySource catch path rather testProbeFailureSemantics's
  // HTTP-500 path above.
  process.env.APP_PUBLIC_URL = "http://127.0.0.1:1";
  try {
    const ctx: DetectorContext = { prisma: {} as never, fetch, workerStartedAt: new Date() };
    await assert.rejects(
      () => probeGlobalNoindex(ctx),
      (err: unknown) => {
        assert.ok(err instanceof Error, "must still throw an Error, never resolve as healthy");
        assert.match(
          err.message,
          /^(robots\.txt|homepage) network error \(http:\/\/127\.0\.0\.1:1/,
          "message must identify which request failed and that it was a network error",
        );
        return true;
      },
    );
  } finally {
    delete process.env.APP_PUBLIC_URL;
  }
}

testProbeNetworkErrorDiagnostics().then(
  () => console.log("globalNoindex.test.ts (probe network error diagnostics): OK"),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
