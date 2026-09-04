import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isDiscoveryPerfEnabled } from "./discoveryPerf";

assert.equal(
  isDiscoveryPerfEnabled({ APP_ENV: "production", NODE_ENV: "production", DEBUG_DISCOVERY_PERF: "true" }),
  false,
  "production must stay silent even if the debug flag is accidentally enabled",
);
assert.equal(
  isDiscoveryPerfEnabled({ APP_ENV: "prod", NODE_ENV: "production", DEBUG_DISCOVERY_PERF: "true" }),
  false,
);
assert.equal(
  isDiscoveryPerfEnabled({ APP_ENV: "dev", NODE_ENV: "production", DEBUG_DISCOVERY_PERF: undefined }),
  true,
  "deployed DEV uses next start/NODE_ENV=production, so APP_ENV must drive diagnostics",
);
assert.equal(
  isDiscoveryPerfEnabled({ APP_ENV: "staging", NODE_ENV: "production", DEBUG_DISCOVERY_PERF: undefined }),
  true,
);
assert.equal(
  isDiscoveryPerfEnabled({ APP_ENV: "dev", NODE_ENV: "production", DEBUG_DISCOVERY_PERF: "false" }),
  false,
  "explicit false must allow temporarily silencing DEV diagnostics",
);
assert.equal(
  isDiscoveryPerfEnabled({ APP_ENV: undefined, NODE_ENV: "development", DEBUG_DISCOVERY_PERF: undefined }),
  true,
  "local next dev remains observable",
);
assert.equal(
  isDiscoveryPerfEnabled({ APP_ENV: undefined, NODE_ENV: "production", DEBUG_DISCOVERY_PERF: undefined }),
  false,
);

const feedSource = readFileSync("src/server/discovery/kudaDiscoveryFeed.ts", "utf8");

for (const step of [
  "where",
  "candidates",
  "cityLookup",
  "engagement",
  "occasion",
  "businessQuality",
  "mapSort",
]) {
  assert.match(feedSource, new RegExp(`perf\\.mark\\("${step}"\\)`), `missing ${step} timing mark`);
}
assert.match(feedSource, /createDiscoveryPerf\("kuda-feed"\)/);
assert.match(feedSource, /createDiscoveryPerf\("kuda-count"\)/);
assert.doesNotMatch(
  feedSource,
  /unstable_cache/,
  "performance instrumentation must not turn the final Event feed into a cached response",
);

const feedLogMeta = feedSource.match(/perf\.log\(\{([\s\S]*?)\}\);\n\n  return result;/)?.[1] ?? "";
assert.ok(feedLogMeta, "feed timing metadata block must exist");
assert.doesNotMatch(
  feedLogMeta,
  /\b(?:currentUserId|ownerUserId|businessIds|activityIds)\s*:/,
  "raw identifiers must never be emitted as timing metadata fields",
);
assert.match(feedLogMeta, /personalized: Boolean\(currentUserId\)/);
assert.match(feedLogMeta, /candidates: rows\.length/);
assert.match(feedLogMeta, /businessCount: businessIds\.length/);

console.log("discovery perf instrumentation tests: OK");
