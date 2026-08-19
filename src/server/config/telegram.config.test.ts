/**
 * Telegram env-name resolution tests (assert-based, project convention).
 * Run: NODE_OPTIONS='--conditions=react-server' tsx src/server/config/telegram.config.test.ts
 *
 * Current Docker env files only have unsuffixed TELEGRAM_BOT_TOKEN /
 * TELEGRAM_BOT_USERNAME. Current code used to read only _DEV/_PROD suffixes,
 * so first PROD of origin/dev would drop Telegram.
 */
import assert from "node:assert/strict";
import NodeModule from "node:module";

const patchableModule = NodeModule as unknown as {
  _load: (request: string, ...rest: unknown[]) => unknown;
};
const originalLoad = patchableModule._load;
patchableModule._load = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.apply(this, [request, ...rest]);
};

const ENV_KEYS = [
  "NODE_ENV",
  "APP_ENV",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_BOT_TOKEN_DEV",
  "TELEGRAM_BOT_TOKEN_PROD",
  "TELEGRAM_BOT_USERNAME",
  "TELEGRAM_BOT_USERNAME_DEV",
  "TELEGRAM_BOT_USERNAME_PROD",
  "TELEGRAM_WEBHOOK_SECRET",
  "TELEGRAM_WEBHOOK_SECRET_DEV",
  "TELEGRAM_WEBHOOK_SECRET_PROD",
] as const;

const mutableEnv = process.env as Record<string, string | undefined>;

function withEnv(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  fn: () => void,
) {
  const saved: Partial<Record<string, string | undefined>> = {};
  for (const key of ENV_KEYS) {
    saved[key] = mutableEnv[key];
  }

  for (const key of ENV_KEYS) {
    const value = overrides[key];
    if (value === undefined) {
      delete mutableEnv[key];
    } else {
      mutableEnv[key] = value;
    }
  }

  try {
    fn();
  } finally {
    for (const key of ENV_KEYS) {
      const value = saved[key];
      if (value === undefined) {
        delete mutableEnv[key];
      } else {
        mutableEnv[key] = value;
      }
    }
  }
}

async function main() {
  const { getTelegramConfig, requiresTelegramWebhookSecret } = await import("./telegram.config");

  withEnv(
    {
      NODE_ENV: "production",
      APP_ENV: "dev",
      TELEGRAM_BOT_TOKEN_DEV: "dev-token",
      TELEGRAM_BOT_USERNAME_DEV: "@mamago_dev_bot",
      TELEGRAM_BOT_TOKEN_PROD: "prod-token",
      TELEGRAM_BOT_USERNAME_PROD: "@mamago_info_bot",
    },
    () => {
      const config = getTelegramConfig();
      assert.equal(config.environment, "DEV");
      assert.equal(config.botToken, "dev-token");
      assert.equal(config.botUsername, "mamago_dev_bot");
      assert.equal(requiresTelegramWebhookSecret(), true);
    },
  );

  withEnv(
    {
      NODE_ENV: "production",
      APP_ENV: "staging",
      TELEGRAM_BOT_TOKEN_DEV: "staging-dev-token",
      TELEGRAM_BOT_USERNAME_DEV: "mamago_dev_bot",
      TELEGRAM_BOT_TOKEN_PROD: "prod-token",
      TELEGRAM_BOT_USERNAME_PROD: "mamago_info_bot",
    },
    () => {
      const config = getTelegramConfig();
      assert.equal(config.environment, "DEV");
      assert.equal(config.botToken, "staging-dev-token");
    },
  );

  withEnv(
    {
      NODE_ENV: "production",
      APP_ENV: "production",
      TELEGRAM_BOT_TOKEN_DEV: "dev-token",
      TELEGRAM_BOT_USERNAME_DEV: "mamago_dev_bot",
      TELEGRAM_BOT_TOKEN_PROD: "prod-token",
      TELEGRAM_BOT_USERNAME_PROD: "mamago_info_bot",
    },
    () => {
      const config = getTelegramConfig();
      assert.equal(config.environment, "PROD");
      assert.equal(config.botToken, "prod-token");
      assert.equal(config.botUsername, "mamago_info_bot");
    },
  );

  withEnv(
    {
      NODE_ENV: "development",
      APP_ENV: "local",
      TELEGRAM_BOT_TOKEN: "unsuffixed-dev-token",
      TELEGRAM_BOT_USERNAME: "@mamaGo_bot",
    },
    () => {
      const config = getTelegramConfig();
      assert.equal(config.environment, "DEV");
      assert.equal(config.botToken, "unsuffixed-dev-token");
      assert.equal(config.botUsername, "mamaGo_bot");
      assert.equal(requiresTelegramWebhookSecret(), false);
    },
  );

  withEnv(
    {
      NODE_ENV: "production",
      APP_ENV: "production",
      TELEGRAM_BOT_TOKEN: "unsuffixed-prod-token",
      TELEGRAM_BOT_USERNAME: "mamaGo_bot",
    },
    () => {
      const config = getTelegramConfig();
      assert.equal(config.environment, "PROD");
      assert.equal(config.botToken, "unsuffixed-prod-token");
      assert.equal(config.botUsername, "mamaGo_bot");
    },
  );

  withEnv(
    {
      NODE_ENV: "production",
      APP_ENV: "production",
      TELEGRAM_BOT_TOKEN: "legacy-token",
      TELEGRAM_BOT_TOKEN_PROD: "preferred-prod-token",
      TELEGRAM_BOT_USERNAME: "legacy_bot",
      TELEGRAM_BOT_USERNAME_PROD: "prod_bot",
    },
    () => {
      const config = getTelegramConfig();
      assert.equal(config.botToken, "preferred-prod-token");
      assert.equal(config.botUsername, "prod_bot");
    },
  );

  withEnv(
    {
      NODE_ENV: "production",
      APP_ENV: "production",
      TELEGRAM_BOT_TOKEN_PROD: undefined,
      TELEGRAM_BOT_TOKEN: undefined,
    },
    () => {
      const config = getTelegramConfig();
      assert.equal(config.botToken, null);
    },
  );

  console.log("telegram config tests: OK");
}

void main();
