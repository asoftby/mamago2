import assert from "node:assert/strict";

import { ABWS_DISTRIBUTOR_COMPANY_ID, buildAbwsSaleframeUrl } from "./saleframeUrl";

// ── sid (per-session): distributor_company_id already present from the API
// — must not be duplicated.
{
  const raw = `https://saleframe.24afisha.by/?sid=1745129&distributor_company_id=${ABWS_DISTRIBUTOR_COMPANY_ID}`;
  const built = buildAbwsSaleframeUrl("sid", raw);
  const url = new URL(built);
  assert.deepEqual(
    url.searchParams.getAll("distributor_company_id"),
    [String(ABWS_DISTRIBUTOR_COMPANY_ID)],
    "distributor_company_id must appear exactly once, not duplicated",
  );
  assert.equal(url.searchParams.get("sid"), "1745129");
  assert.equal(url.searchParams.get("lang"), "ru");
}

// ── pid (whole-event): distributor_company_id never present from the API
// — must be added, exactly once.
{
  const raw = "https://saleframe.24afisha.by/?pid=332622";
  const built = buildAbwsSaleframeUrl("pid", raw);
  const url = new URL(built);
  assert.deepEqual(
    url.searchParams.getAll("distributor_company_id"),
    [String(ABWS_DISTRIBUTOR_COMPANY_ID)],
    "pid link must get distributor_company_id added exactly once",
  );
  assert.equal(url.searchParams.get("pid"), "332622");
  assert.equal(url.searchParams.get("lang"), "ru");
}

// ── lang: added when absent (both kinds), never duplicated when already present.
{
  const built = buildAbwsSaleframeUrl("pid", "https://saleframe.24afisha.by/?pid=1");
  assert.deepEqual(new URL(built).searchParams.getAll("lang"), ["ru"]);
}
{
  const raw = "https://saleframe.24afisha.by/?sid=1&distributor_company_id=550&lang=ru";
  const built = buildAbwsSaleframeUrl("sid", raw);
  const url = new URL(built);
  assert.deepEqual(url.searchParams.getAll("lang"), ["ru"], "lang must not be duplicated if already present");
  assert.deepEqual(url.searchParams.getAll("distributor_company_id"), ["550"]);
}
// A pre-existing non-"ru" lang is left as-is, not overridden — only absent
// params are filled in, existing values are never second-guessed.
{
  const raw = "https://saleframe.24afisha.by/?pid=1&lang=en";
  const built = buildAbwsSaleframeUrl("pid", raw);
  const url = new URL(built);
  assert.deepEqual(url.searchParams.getAll("lang"), ["en"]);
  assert.equal(url.searchParams.get("distributor_company_id"), String(ABWS_DISTRIBUTOR_COMPANY_ID));
}

// ── sid never gets distributor_company_id added if genuinely absent from input
// (shouldn't happen per live data, but the function must not silently add it
// for sid — only pid is allowed to gain that param here).
{
  const raw = "https://saleframe.24afisha.by/?sid=999";
  const built = buildAbwsSaleframeUrl("sid", raw);
  const url = new URL(built);
  assert.equal(url.searchParams.has("distributor_company_id"), false);
}

console.log("saleframeUrl tests: OK");
