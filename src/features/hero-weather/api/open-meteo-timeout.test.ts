import assert from "node:assert/strict";

import { OpenMeteoWeatherProvider } from "./open-meteo-provider";

// --- Open-Meteo must fail fast: a hung upstream must not stall the caller
// anywhere near the old 10s budget. This is the P0 guard for the public
// request path (see CityHomePage's Suspense-wrapped hero weather section). ---

void (async () => {
  const realFetch = global.fetch;

  // Simulate an Open-Meteo request that never resolves on its own, but still
  // honors AbortSignal the way the real `fetch` does — otherwise this test
  // would hang forever instead of exercising the timeout path.
  global.fetch = ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (signal) {
        signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }
    })) as unknown as typeof fetch;

  try {
    const provider = new OpenMeteoWeatherProvider();
    const start = Date.now();
    const result = await provider.fetchWeather({ latitude: 53.9, longitude: 27.56 });
    const elapsed = Date.now() - start;

    assert.equal(result, null, "hung upstream must resolve to null, not hang or throw");
    assert.ok(
      elapsed < 5000,
      `expected the request to fail fast (well under the old 10s), got ${elapsed}ms`,
    );

    console.log(`open-meteo timeout test: OK (fell back after ${elapsed}ms)`);
  } finally {
    global.fetch = realFetch;
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
