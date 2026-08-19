/**
 * Live-network regression for the family.by incomplete-TLS-chain release
 * blocker (UNABLE_TO_VERIFY_LEAF_SIGNATURE on POST /api/media/from-url).
 *
 * Deliberately NOT part of `pnpm check` / `check:push` / `tsc --noEmit` /
 * `pnpm build` — it makes a real HTTPS request to a third-party site and
 * would be flaky in CI. The deterministic regression for the TLS transport
 * itself lives in fetchHtml.test.ts (pinned CA bundle/fingerprints + mocked
 * transport-failure classification) and safeRemoteImageUrl.test.ts (SSRF).
 *
 * Run manually: pnpm test:media-from-url-family-by-live
 */
import assert from "node:assert/strict";

import { fetchBinary } from "./fetchHtml";

const TARGET_URL = "https://family.by/uploads/posts/2026-08/thumbs/1787118815_ebru.jpg";
const MAX_BYTES = 10 * 1024 * 1024;

async function main() {
  const result = await fetchBinary(TARGET_URL, {
    timeoutMs: 25_000,
    maxBytes: MAX_BYTES,
    headers: {
      Accept: "image/*,*/*;q=0.8",
      "User-Agent": "MamaGoMediaImporter/1.0",
    },
    validateUrl: () => {}, // same-host request, no redirect hops to police here
  });

  assert.equal(result.status, 200);
  assert.ok(result.buffer.length > 0, "downloaded body must not be empty");
  assert.ok(result.buffer.length <= MAX_BYTES, "downloaded body must respect MAX_BYTES");

  // JPEG magic bytes — proves this is real image transport, not just a
  // 200 with an empty/error body.
  assert.equal(result.buffer[0], 0xff);
  assert.equal(result.buffer[1], 0xd8);

  console.log(
    `fetchBinary family.by live regression: OK (status=${result.status}, bytes=${result.buffer.length}, finalUrl=${result.finalUrl})`,
  );
}

main().catch((err) => {
  console.error("fetchBinary family.by live regression: FAILED");
  console.error(err);
  process.exit(1);
});
