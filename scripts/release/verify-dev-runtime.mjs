#!/usr/bin/env node
// Strict, read-only DEV runtime provenance check. No deployment or secrets.
const [url, expectedSha, expectedBuild] = process.argv.slice(2);
if (!url || !/^https:\/\/dev\.mamago\.by\/api\/health\/?$/.test(url) ||
    !/^[a-f0-9]{40}$/.test(expectedSha || "") ||
    !/^dev-[0-9]+$/.test(expectedBuild || "")) {
  console.error("Usage: node scripts/release/verify-dev-runtime.mjs https://dev.mamago.by/api/health <40-char-sha> dev-N");
  process.exit(2);
}
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), cache: "no-store", redirect: "error" });
  if (!response.ok) throw new Error("Health HTTP " + response.status);
  const data = await response.json();
  const match = data.status === "ok" && data.db === "ok" &&
    data.gitSha === expectedSha && data.buildId === expectedBuild;
  if (!match) {
    console.error("DEV_PARITY_FAILED", JSON.stringify({
      expectedSha, actualSha: data.gitSha ?? null,
      expectedBuild, actualBuild: data.buildId ?? null,
      status: data.status ?? null, db: data.db ?? null,
    }));
    process.exit(1);
  }
  console.log("DEV_PARITY_OK", JSON.stringify({ gitSha: expectedSha, buildId: expectedBuild }));
} catch (err) {
  console.error("DEV_PARITY_FAILED", err.message);
  process.exit(1);
}
