/**
 * Public URL fallback must follow APP_ENV, not NODE_ENV.
 * Run: tsx src/lib/config/publicAppUrl.test.ts
 */
import assert from "node:assert/strict";
import { getCanonicalPublicAppUrl, getConfiguredPublicAppUrl } from "./publicAppUrl";

const ENV_KEYS = ["NODE_ENV", "APP_ENV", "APP_PUBLIC_URL", "NEXT_PUBLIC_APP_URL"] as const;
const mutableEnv = process.env as Record<string, string | undefined>;

function withEnv(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  fn: () => void,
) {
  const saved: Partial<Record<string, string | undefined>> = {};
  for (const key of ENV_KEYS) saved[key] = mutableEnv[key];
  for (const key of ENV_KEYS) {
    const value = overrides[key];
    if (value === undefined) delete mutableEnv[key];
    else mutableEnv[key] = value;
  }
  try {
    fn();
  } finally {
    for (const key of ENV_KEYS) {
      const value = saved[key];
      if (value === undefined) delete mutableEnv[key];
      else mutableEnv[key] = value;
    }
  }
}

withEnv(
  {
    NODE_ENV: "production",
    APP_ENV: "dev",
    APP_PUBLIC_URL: undefined,
    NEXT_PUBLIC_APP_URL: undefined,
  },
  () => {
    assert.equal(getConfiguredPublicAppUrl(), null);
    assert.equal(getCanonicalPublicAppUrl(), "http://mamago.local:3000");
  },
);

withEnv(
  {
    NODE_ENV: "production",
    APP_ENV: "production",
    APP_PUBLIC_URL: undefined,
    NEXT_PUBLIC_APP_URL: undefined,
  },
  () => {
    assert.equal(getCanonicalPublicAppUrl(), "https://mamago.by");
  },
);

withEnv(
  {
    NODE_ENV: "production",
    APP_ENV: "dev",
    APP_PUBLIC_URL: "https://dev.mamago.by/",
    NEXT_PUBLIC_APP_URL: undefined,
  },
  () => {
    assert.equal(getCanonicalPublicAppUrl(), "https://dev.mamago.by");
  },
);

console.log("publicAppUrl tests: OK");
