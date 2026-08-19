/**
 * Email configuration health + debug-redirect tests.
 * Run: tsx src/features/email/server/email-config.test.ts
 */
import assert from "node:assert/strict";
import {
  getEmailDeliveryConfigurationStatus,
  resolveEmailRecipient,
} from "./email-config";

const ENV_KEYS = [
  "EMAIL_ENABLED",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
  "EMAIL_DEBUG_REDIRECT_TO",
  "APP_PUBLIC_URL",
  "NEXT_PUBLIC_APP_URL",
] as const;

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
    EMAIL_ENABLED: "false",
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "mamaGo <no-reply@mamago.by>",
    EMAIL_REPLY_TO: "hello@mamago.by",
    EMAIL_DEBUG_REDIRECT_TO: undefined,
    APP_PUBLIC_URL: "https://dev.mamago.by",
  },
  () => {
    const health = getEmailDeliveryConfigurationStatus();
    assert.equal(health.enabled, false);
    assert.equal(health.configured, false);
  },
);

withEnv(
  {
    EMAIL_ENABLED: "true",
    RESEND_API_KEY: undefined,
    EMAIL_FROM: "mamaGo <no-reply@mamago.by>",
    EMAIL_REPLY_TO: "hello@mamago.by",
    EMAIL_DEBUG_REDIRECT_TO: undefined,
    APP_PUBLIC_URL: "https://dev.mamago.by",
  },
  () => {
    const health = getEmailDeliveryConfigurationStatus();
    assert.equal(health.enabled, true);
    assert.equal(health.configured, false);
    assert.deepEqual(health.missingKeys, ["RESEND_API_KEY"]);
  },
);

withEnv(
  {
    EMAIL_ENABLED: "true",
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "mamaGo <no-reply@mamago.by>",
    EMAIL_REPLY_TO: "hello@mamago.by",
    EMAIL_DEBUG_REDIRECT_TO: undefined,
    APP_PUBLIC_URL: "https://prod.mamago.by",
  },
  () => {
    const health = getEmailDeliveryConfigurationStatus();
    assert.equal(health.enabled, true);
    assert.equal(health.configured, true);
    assert.equal(health.debugRedirect, false);
    assert.equal(health.from, "mamaGo <no-reply@mamago.by>");
    assert.equal(health.publicUrl, "https://prod.mamago.by");
    const recipient = resolveEmailRecipient("user@example.com");
    assert.equal(recipient.actualTo, "user@example.com");
    assert.equal(recipient.debugRedirect, false);
  },
);

withEnv(
  {
    EMAIL_ENABLED: "true",
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "mamaGo <no-reply@mamago.by>",
    EMAIL_REPLY_TO: "hello@mamago.by",
    EMAIL_DEBUG_REDIRECT_TO: "owner@example.com",
    APP_PUBLIC_URL: "https://dev.mamago.by",
  },
  () => {
    const health = getEmailDeliveryConfigurationStatus();
    assert.equal(health.debugRedirect, true);
    const recipient = resolveEmailRecipient("user@example.com");
    assert.equal(recipient.actualTo, "owner@example.com");
    assert.equal(recipient.debugRedirect, true);
  },
);

console.log("email-config tests: OK");
