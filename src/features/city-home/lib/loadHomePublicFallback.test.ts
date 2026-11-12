import assert from "node:assert/strict";
import test from "node:test";
import { loadHomePublicFallback } from "./loadHomePublicFallback";

test("public fallback is an independent general catalog query without global age params", async () => {
  let requested = "";
  const fake = (async (url: string) => {
    requested = url;
    return new Response(JSON.stringify({
      items: [{ id: "event1", title: "Test event", slug: "test", ageFrom: 4 }],
    }), { status: 200 });
  }) as typeof fetch;
  const result = await loadHomePublicFallback("minsk", fake);
  assert.equal(requested, "/api/discovery/events/page?listingCity=minsk&page=1");
  assert.equal(result?.length, 1);
  assert.equal(result?.[0]?.id, "event1");
});

test("invalid or failed response is not mistaken for proof of zero events", async () => {
  const unavailable = (async () => new Response(null, { status: 503 })) as typeof fetch;
  assert.equal(await loadHomePublicFallback("minsk", unavailable), null);
  const validEmpty = (async () => new Response('{"items":[]}')) as typeof fetch;
  assert.deepEqual(await loadHomePublicFallback("minsk", validEmpty), []);
  const malformed = (async () => new Response('{"foo":"bar"}')) as typeof fetch;
  assert.equal(await loadHomePublicFallback("minsk", malformed), null);
});
