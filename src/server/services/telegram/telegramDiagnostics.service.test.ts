/**
 * Telegram webhook expected-origin tests.
 * Run: NODE_OPTIONS='--conditions=react-server' tsx src/server/services/telegram/telegramDiagnostics.service.test.ts
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

const ENV_KEYS = ["NODE_ENV", "APP_ENV", "APP_PUBLIC_URL", "NEXT_PUBLIC_APP_URL"] as const;
const mutableEnv = process.env as Record<string, string | undefined>;

function withEnv(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  fn: () => void | Promise<void>,
): Promise<void> {
  const saved: Partial<Record<string, string | undefined>> = {};
  for (const key of ENV_KEYS) saved[key] = mutableEnv[key];
  for (const key of ENV_KEYS) {
    const value = overrides[key];
    if (value === undefined) delete mutableEnv[key];
    else mutableEnv[key] = value;
  }
  return Promise.resolve()
    .then(() => fn())
    .finally(() => {
      for (const key of ENV_KEYS) {
        const value = saved[key];
        if (value === undefined) delete mutableEnv[key];
        else mutableEnv[key] = value;
      }
    });
}

async function main() {
  const { resolveConfiguredWebhookOrigin, TELEGRAM_WEBHOOK_PATH } = await import(
    "./telegramDiagnostics.service"
  );

  await withEnv(
    {
      NODE_ENV: "development",
      APP_ENV: "local",
      APP_PUBLIC_URL: "http://mamago.local:3000",
      NEXT_PUBLIC_APP_URL: undefined,
    },
    () => {
      assert.equal(resolveConfiguredWebhookOrigin(), null, "local URL must not be a webhook origin");
    },
  );

  await withEnv(
    {
      NODE_ENV: "production",
      APP_ENV: "dev",
      APP_PUBLIC_URL: "https://dev.mamago.by",
      NEXT_PUBLIC_APP_URL: undefined,
    },
    () => {
      assert.equal(resolveConfiguredWebhookOrigin(), "https://dev.mamago.by");
      assert.equal(
        `${resolveConfiguredWebhookOrigin()}${TELEGRAM_WEBHOOK_PATH}`,
        "https://dev.mamago.by/api/bot/webhook",
      );
    },
  );

  await withEnv(
    {
      NODE_ENV: "production",
      APP_ENV: "production",
      APP_PUBLIC_URL: "https://prod.mamago.by",
      NEXT_PUBLIC_APP_URL: undefined,
    },
    () => {
      assert.equal(resolveConfiguredWebhookOrigin(), "https://prod.mamago.by");
      assert.equal(
        `${resolveConfiguredWebhookOrigin()}${TELEGRAM_WEBHOOK_PATH}`,
        "https://prod.mamago.by/api/bot/webhook",
      );
    },
  );

  console.log("telegram diagnostics tests: OK");
}

void main();
