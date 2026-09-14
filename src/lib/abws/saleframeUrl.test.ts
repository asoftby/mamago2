import assert from "node:assert/strict";

import { ABWS_DISTRIBUTOR_COMPANY_ID, buildAbwsSaleframeUrl, decorateStoredTicketLink } from "./saleframeUrl";

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

// ── decorateStoredTicketLink ────────────────────────────────────────────────

// Our own import always writes a pid link — gets distributor_company_id + lang.
{
  const decorated = decorateStoredTicketLink("https://saleframe.24afisha.by/?pid=332622");
  const url = new URL(decorated);
  assert.equal(url.searchParams.get("distributor_company_id"), String(ABWS_DISTRIBUTOR_COMPANY_ID));
  assert.equal(url.searchParams.get("lang"), "ru");
}

// A human pasted a sid link into the ticketLink field by hand — must be
// detected as sid from the URL itself, NOT treated as pid just because it
// came from the ticketLink field. distributor_company_id (already present)
// must not be duplicated.
{
  const rawSid = `https://saleframe.24afisha.by/?sid=1745129&distributor_company_id=${ABWS_DISTRIBUTOR_COMPANY_ID}`;
  const decorated = decorateStoredTicketLink(rawSid);
  const url = new URL(decorated);
  assert.deepEqual(
    url.searchParams.getAll("distributor_company_id"),
    [String(ABWS_DISTRIBUTOR_COMPANY_ID)],
    "a sid link in ticketLink must not get a second distributor_company_id",
  );
  assert.equal(url.searchParams.get("lang"), "ru");
}

// A business's own manually-entered ticket URL for a non-ABWS event — must
// be returned completely unchanged, no saleframe params invented for it.
{
  const raw = "https://ticketpro.by/event/12345";
  assert.equal(decorateStoredTicketLink(raw), raw);
}

// Invalid input a human could plausibly type by hand — must never throw,
// must return the input as-is (or empty) rather than crash the page.
{
  assert.equal(decorateStoredTicketLink("example.com"), "example.com", "no scheme — new URL() would throw");
  assert.equal(decorateStoredTicketLink("not a url at all"), "not a url at all");
  assert.equal(decorateStoredTicketLink(""), "");
  assert.equal(decorateStoredTicketLink(null), "");
  assert.equal(decorateStoredTicketLink(undefined), "");
}

console.log("saleframeUrl tests: OK");
