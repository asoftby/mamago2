import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import {
  buildServiceAccountAssertion,
  pageClickMovers,
  resolveGoogleSearchConsoleConfig,
  searchConsoleComparisonRanges,
} from "./googleSearchConsole";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

{
  assert.equal(resolveGoogleSearchConsoleConfig({}), null);
  assert.equal(resolveGoogleSearchConsoleConfig({ GOOGLE_SEARCH_CONSOLE_ENABLED: "true" }), null);
  const config = resolveGoogleSearchConsoleConfig({
    GOOGLE_SEARCH_CONSOLE_ENABLED: "true",
    GOOGLE_SEARCH_CONSOLE_SITE_URL: "sc-domain:mamago.by",
    GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL: "gsc-reader@example.iam.gserviceaccount.com",
    GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY: pem.replace(/\n/g, "\\n"),
  });
  assert.ok(config);
  assert.equal(config.siteUrl, "sc-domain:mamago.by");
  assert.ok(config.privateKey.includes("\n"));

  const assertion = buildServiceAccountAssertion(config, new Date("2026-09-02T12:00:00Z"));
  assert.equal(assertion.split(".").length, 3);
}

{
  const ranges = searchConsoleComparisonRanges(new Date("2026-09-02T12:00:00Z"));
  assert.deepEqual(ranges.current, { startDate: "2026-08-25", endDate: "2026-08-31" });
  assert.deepEqual(ranges.previous, { startDate: "2026-08-18", endDate: "2026-08-24" });
}

{
  const current = [
    { keys: ["https://mamago.by/a"], clicks: 20, impressions: 100, ctr: 0.2, position: 3 },
    { keys: ["https://mamago.by/b"], clicks: 5, impressions: 30, ctr: 0.16, position: 5 },
  ];
  const previous = [
    { keys: ["https://mamago.by/a"], clicks: 10, impressions: 80, ctr: 0.125, position: 4 },
    { keys: ["https://mamago.by/c"], clicks: 12, impressions: 50, ctr: 0.24, position: 2 },
  ];
  const movers = pageClickMovers(current, previous);
  assert.deepEqual(movers.rising[0], { page: "https://mamago.by/a", delta: 10 });
  assert.deepEqual(movers.falling[0], { page: "https://mamago.by/c", delta: -12 });
}

console.log("googleSearchConsole.test.ts: OK");
