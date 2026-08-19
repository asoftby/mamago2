/**
 * Run: npx tsx src/lib/system/buildInfo.test.ts
 */
import assert from "node:assert/strict";

import { getBuildInfo } from "./buildInfo";

const ENV_KEYS = ["BUILD_ID", "GIT_COMMIT_SHA", "VERCEL_GIT_COMMIT_SHA"] as const;

function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) previous[key] = process.env[key];

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    fn();
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

withEnv(
  { BUILD_ID: undefined, GIT_COMMIT_SHA: undefined, VERCEL_GIT_COMMIT_SHA: undefined },
  () => {
    const info = getBuildInfo();
    assert.equal(info.buildId, null, "buildId must be null when BUILD_ID is unset");
    assert.equal(info.commitSha, null, "commitSha must be null when no git sha env is set");
  },
);

withEnv(
  { BUILD_ID: "dev-310", GIT_COMMIT_SHA: "a".repeat(40), VERCEL_GIT_COMMIT_SHA: undefined },
  () => {
    const info = getBuildInfo();
    assert.equal(info.buildId, "dev-310");
    assert.equal(info.commitSha, "a".repeat(40));
    assert.equal(info.commitShortSha, "a".repeat(7));
  },
);

withEnv({ BUILD_ID: "  ", GIT_COMMIT_SHA: undefined, VERCEL_GIT_COMMIT_SHA: undefined }, () => {
  const info = getBuildInfo();
  assert.equal(info.buildId, null, "whitespace-only env value must be treated as unset");
});

console.log("buildInfo.test.ts: OK");
