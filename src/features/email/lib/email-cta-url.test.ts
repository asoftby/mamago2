/**
 * Run: tsx src/features/email/lib/email-cta-url.test.ts
 */
import assert from "node:assert/strict";
import { resolveEmailCtaUrl } from "./email-cta-url";

const ENV_KEYS = ["APP_ENV", "APP_PUBLIC_URL", "NEXT_PUBLIC_APP_URL", "NODE_ENV"] as const;
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
    APP_ENV: "dev",
    APP_PUBLIC_URL: "https://dev.mamago.by",
    NEXT_PUBLIC_APP_URL: undefined,
    NODE_ENV: "production",
  },
  () => {
    assert.equal(
      resolveEmailCtaUrl("/settings/notifications"),
      "https://dev.mamago.by/settings/notifications",
    );
  },
);

withEnv(
  {
    APP_ENV: "production",
    APP_PUBLIC_URL: "https://prod.mamago.by",
    NEXT_PUBLIC_APP_URL: undefined,
    NODE_ENV: "production",
  },
  () => {
    assert.equal(
      resolveEmailCtaUrl("/settings/notifications"),
      "https://prod.mamago.by/settings/notifications",
    );
  },
);

withEnv(
  {
    APP_ENV: "dev",
    APP_PUBLIC_URL: "https://dev.mamago.by",
    NEXT_PUBLIC_APP_URL: undefined,
    NODE_ENV: "production",
  },
  () => {
    assert.equal(
      resolveEmailCtaUrl("https://example.com/foo"),
      "https://example.com/foo",
    );
    assert.equal(resolveEmailCtaUrl("javascript:alert(1)"), null);
  },
);

console.log("email-cta-url tests: OK");
