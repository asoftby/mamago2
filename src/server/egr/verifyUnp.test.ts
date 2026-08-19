import assert from "node:assert/strict";

import { lookupUnpInEgr } from "./verifyUnp";

const ACTIVE_UNP = "691868900"; // valid checksum, matches GRP example payload from the task spec

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fetchOnce(impl: () => Response | Promise<Response>): typeof fetch {
  return (async () => impl()) as unknown as typeof fetch;
}

void (async () => {
  // --- 1. active payer ---
  {
    const result = await lookupUnpInEgr(
      ACTIVE_UNP,
      {
        fetchImpl: fetchOnce(() =>
          jsonResponse({
            row: {
              vunp: ACTIVE_UNP,
              vnaimp: "Полное наименование",
              vnaimk: "Краткое наименование",
              vpadres: "адрес",
              dreg: "2015-07-15",
              ckodsost: "1",
              vkods: "Действующий",
              dlikv: null,
              vlikv: null,
            },
          }),
        ),
      },
    );
    assert.equal(result.found, true);
    assert.equal(result.status, "ACTIVE");
    assert.equal(result.officialNameFull, "Полное наименование");
  }

  // --- 2. liquidating payer (ckodsost "M", real code observed live on grp.nalog.gov.by) ---
  {
    const result = await lookupUnpInEgr(
      ACTIVE_UNP,
      {
        fetchImpl: fetchOnce(() =>
          jsonResponse({
            row: {
              vunp: ACTIVE_UNP,
              vnaimp: "ООО в ликвидации",
              ckodsost: "M",
              vkods: "В процессе ликвидации",
              dlikv: "2026-06-08",
            },
          }),
        ),
      },
    );
    assert.equal(result.found, true);
    assert.equal(result.status, "LIQUIDATING");
    assert.equal(result.statusRaw, "В процессе ликвидации");
  }

  // --- 2b. excluded/fully liquidated payer (ckodsost "L") — dlikv alone can't
  // distinguish this from case 2 above (both have it set); only ckodsost does ---
  {
    const result = await lookupUnpInEgr(
      ACTIVE_UNP,
      {
        fetchImpl: fetchOnce(() =>
          jsonResponse({
            row: {
              vunp: ACTIVE_UNP,
              vnaimp: "Кооператив ликвидирован",
              ckodsost: "L",
              vkods: "Ликвидирован",
              dlikv: "1997-03-05",
            },
          }),
        ),
      },
    );
    assert.equal(result.found, true);
    assert.equal(result.status, "EXCLUDED");
    assert.equal(result.statusRaw, "Ликвидирован");
  }

  // --- 3. not found in registry (successful response, no row) ---
  {
    const result = await lookupUnpInEgr(
      ACTIVE_UNP,
      { fetchImpl: fetchOnce(() => jsonResponse({})) },
    );
    assert.equal(result.found, false);
    assert.equal(result.status, "UNKNOWN");
    assert.equal(result.networkFailed, false);
  }

  // --- 4. registry unavailable after retries (timeout/network error) ---
  {
    let callCount = 0;
    const result = await lookupUnpInEgr(ACTIVE_UNP, {
      retryBaseDelayMs: 0,
      fetchImpl: (async () => {
        callCount += 1;
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        throw error;
      }) as unknown as typeof fetch,
    });
    assert.equal(result.found, false);
    assert.equal(result.status, "UNKNOWN");
    assert.equal(result.networkFailed, true);
    assert.equal(callCount, 2); // initial attempt + 1 retry (matches resolveByUnp.ts convention)

    // --- 4b. transient 503s that recover on the last retry stay fail-open by design,
    // and here also demonstrate a successful recovery ---
    let attempt503 = 0;
    const recovered = await lookupUnpInEgr(ACTIVE_UNP, {
      retryBaseDelayMs: 0,
      fetchImpl: (async () => {
        attempt503 += 1;
        if (attempt503 < 2) return jsonResponse({}, 503);
        return jsonResponse({
          row: { vunp: ACTIVE_UNP, vnaimp: "Recovered Co", ckodsost: "1", vkods: "Действующий" },
        });
      }) as unknown as typeof fetch,
    });
    assert.equal(recovered.found, true);
    assert.equal(recovered.status, "ACTIVE");
  }

  // --- 5. invalid УНП format/checksum: no network call, throws synchronously ---
  {
    let called = false;
    await assert.rejects(
      () =>
        lookupUnpInEgr("123456789", {
          fetchImpl: (async () => {
            called = true;
            throw new Error("should not be called");
          }) as unknown as typeof fetch,
        }),
      /Некорректный УНП/,
    );
    assert.equal(called, false);
  }

  console.log("verifyUnp tests: OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
