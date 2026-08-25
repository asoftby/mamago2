/** Pure fail-closed config tests. */
import assert from "node:assert/strict";
import { resolveExternalAnalyticsConfig } from "./externalAnalyticsConfig";

function main() {
  assert.deepEqual(resolveExternalAnalyticsConfig({}), {
    enabled: false,
    googleAnalyticsId: null,
    yandexMetrikaId: null,
  });

  assert.deepEqual(
    resolveExternalAnalyticsConfig({
      APP_ENV: "dev",
      EXTERNAL_ANALYTICS_ENABLED: "true",
      GOOGLE_ANALYTICS_ID: "G-ABC123",
      YANDEX_METRIKA_ID: "12345678",
    }),
    {
      enabled: false,
      googleAnalyticsId: null,
      yandexMetrikaId: null,
    },
    "non-PROD must stay disabled even when IDs are present",
  );

  assert.deepEqual(
    resolveExternalAnalyticsConfig({
      APP_ENV: "production",
      EXTERNAL_ANALYTICS_ENABLED: "true",
      GOOGLE_ANALYTICS_ID: " g-abc123 ",
      YANDEX_METRIKA_ID: "12345678",
    }),
    {
      enabled: true,
      googleAnalyticsId: "G-ABC123",
      yandexMetrikaId: 12345678,
    },
  );

  assert.deepEqual(
    resolveExternalAnalyticsConfig({
      APP_ENV: "prod",
      EXTERNAL_ANALYTICS_ENABLED: "true",
      GOOGLE_ANALYTICS_ID: "UA-legacy",
      YANDEX_METRIKA_ID: "not-a-number",
    }),
    {
      enabled: true,
      googleAnalyticsId: null,
      yandexMetrikaId: null,
    },
    "invalid provider IDs fail closed independently",
  );

  console.log("externalAnalyticsConfig.test.ts: OK");
}

main();
