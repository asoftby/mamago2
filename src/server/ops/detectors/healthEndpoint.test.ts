/**
 * health_endpoint detector tests (§21 Step 3, Phase D).
 * Pure evaluate() tests need no network. probe() is separately exercised
 * against a controlled local HTTP server — no real internet required.
 *
 * Run: npx tsx src/server/ops/detectors/healthEndpoint.test.ts
 */
import assert from "node:assert/strict";
import http from "node:http";

import {
  evaluateHealthEndpoint,
  extractHealthReleaseMetadata,
  probeHealthEndpoint,
  type HealthEndpointProbeOutcome,
} from "./healthEndpoint";

// ── Pure evaluate() tests ──────────────────────────────────────────────

// Healthy 200 + valid payload -> no signals.
{
  const outcome: HealthEndpointProbeOutcome = {
    kind: "parsed",
    httpStatus: 200,
    body: { status: "ok", db: "ok", buildId: "dev-1", gitSha: "abc", processStartedAt: "2026-08-16T00:00:00.000Z" },
  };
  const result = evaluateHealthEndpoint(outcome);
  assert.deepEqual(result.signals, []);
}

// Network error -> CRITICAL.
{
  const result = evaluateHealthEndpoint({ kind: "network_error", message: "ECONNREFUSED" });
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].severity, "CRITICAL");
  assert.equal(result.signals[0].type, "HEALTH_ENDPOINT_FAILED");
}

// Timeout -> CRITICAL.
{
  const result = evaluateHealthEndpoint({ kind: "timeout" });
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].severity, "CRITICAL");
}

// HTTP 500 -> CRITICAL.
{
  const result = evaluateHealthEndpoint({ kind: "http_error", httpStatus: 500 });
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].severity, "CRITICAL");
}

// HTTP 404 -> CRITICAL.
{
  const result = evaluateHealthEndpoint({ kind: "http_error", httpStatus: 404 });
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].severity, "CRITICAL");
}

// HTTP 200 invalid JSON -> CRITICAL.
{
  const result = evaluateHealthEndpoint({ kind: "invalid_json" });
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].severity, "CRITICAL");
}

// status != ok -> CRITICAL.
{
  const outcome: HealthEndpointProbeOutcome = {
    kind: "parsed",
    httpStatus: 200,
    body: { status: "error", db: "ok" },
  };
  const result = evaluateHealthEndpoint(outcome);
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].severity, "CRITICAL");
}

// db != ok -> CRITICAL.
{
  const outcome: HealthEndpointProbeOutcome = {
    kind: "parsed",
    httpStatus: 200,
    body: { status: "ok", db: "unavailable" },
  };
  const result = evaluateHealthEndpoint(outcome);
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].severity, "CRITICAL");
}

// Every failure fingerprint is identical (the frozen `prod` discriminator,
// so reconciliation treats all failure kinds as the same incident).
{
  const outcomes: HealthEndpointProbeOutcome[] = [
    { kind: "network_error", message: "x" },
    { kind: "timeout" },
    { kind: "http_error", httpStatus: 503 },
    { kind: "invalid_json" },
  ];
  const fingerprints = new Set(outcomes.map((o) => evaluateHealthEndpoint(o).signals[0].fingerprint));
  assert.equal(fingerprints.size, 1);
  assert.equal([...fingerprints][0], "health.endpoint_failed:prod");
}

// extractHealthReleaseMetadata: only extracts from a healthy parsed probe
// with buildId + processStartedAt present.
{
  const healthy: HealthEndpointProbeOutcome = {
    kind: "parsed",
    httpStatus: 200,
    body: { status: "ok", db: "ok", buildId: "dev-42", gitSha: "deadbeef", processStartedAt: "2026-08-16T00:00:00.000Z" },
  };
  const meta = extractHealthReleaseMetadata(healthy);
  assert.equal(meta?.buildId, "dev-42");
  assert.equal(meta?.gitSha, "deadbeef");
  assert.equal(meta?.processStartedAt.toISOString(), "2026-08-16T00:00:00.000Z");

  assert.equal(extractHealthReleaseMetadata({ kind: "timeout" }), null);
  assert.equal(
    extractHealthReleaseMetadata({ kind: "parsed", httpStatus: 200, body: { status: "ok", db: "ok" } }),
    null,
    "missing buildId -> nothing to key a release on",
  );
}

// ── probe() against a controlled local HTTP server (no real internet) ──

async function testProbeAgainstLocalServer() {
  const server = http.createServer((req, res) => {
    if (req.url === "/healthy") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", db: "ok", buildId: "dev-1", gitSha: "x", processStartedAt: "2026-08-16T00:00:00.000Z" }));
      return;
    }
    if (req.url === "/http-error") {
      res.writeHead(503);
      res.end("service unavailable");
      return;
    }
    if (req.url === "/bad-json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end("not json");
      return;
    }
    if (req.url === "/slow") {
      setTimeout(() => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "ok", db: "ok" }));
      }, 500);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to bind local test server");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const healthy = await probeHealthEndpoint(fetch, `${base}/healthy`);
    assert.equal(healthy.kind, "parsed");

    const httpError = await probeHealthEndpoint(fetch, `${base}/http-error`);
    assert.equal(httpError.kind, "http_error");
    assert.equal((httpError as { httpStatus: number }).httpStatus, 503);

    const badJson = await probeHealthEndpoint(fetch, `${base}/bad-json`);
    assert.equal(badJson.kind, "invalid_json");

    const notFound = await probeHealthEndpoint(fetch, `${base}/does-not-exist`);
    assert.equal(notFound.kind, "http_error");
    assert.equal((notFound as { httpStatus: number }).httpStatus, 404);

    const timedOut = await probeHealthEndpoint(fetch, `${base}/slow`, 50);
    assert.equal(timedOut.kind, "timeout");

    const networkError = await probeHealthEndpoint(fetch, "http://127.0.0.1:1"); // nothing listens on port 1
    assert.equal(networkError.kind, "network_error");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

testProbeAgainstLocalServer().then(
  () => console.log("healthEndpoint.test.ts: OK"),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
