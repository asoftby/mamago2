/**
 * Parser/rules tests for the bounded SEO verifier — no network, no DB.
 *
 * Запуск: npx tsx scripts/verify-prelaunch-seo.test.ts
 */
import assert from "node:assert/strict";
import {
  extractCanonicals,
  extractRobotsMeta,
  extractJsonLdBlocks,
  checkCanonicalIssues,
  checkRobotsContradiction,
} from "./verify-prelaunch-seo";

function testExtractCanonicalSingle() {
  const html = `<html><head><link rel="canonical" href="https://mamago.by/places/foo"></head></html>`;
  assert.deepEqual(extractCanonicals(html), ["https://mamago.by/places/foo"]);
}

function testExtractCanonicalNone() {
  assert.deepEqual(extractCanonicals(`<html><head></head></html>`), []);
}

function testExtractCanonicalMultiple() {
  const html = `<link rel="canonical" href="https://mamago.by/a"><link rel="canonical" href="https://mamago.by/b">`;
  assert.deepEqual(extractCanonicals(html), ["https://mamago.by/a", "https://mamago.by/b"]);
}

function testExtractCanonicalAttributeOrderIndependent() {
  const html = `<link href="https://mamago.by/x" rel="canonical">`;
  assert.deepEqual(extractCanonicals(html), ["https://mamago.by/x"]);
}

function testExtractRobotsMeta() {
  const html = `<meta name="robots" content="noindex, nofollow">`;
  assert.equal(extractRobotsMeta(html), "noindex, nofollow");
}

function testExtractRobotsMetaAttributeOrderIndependent() {
  const html = `<meta content="index, follow" name="robots">`;
  assert.equal(extractRobotsMeta(html), "index, follow");
}

function testExtractRobotsMetaAbsent() {
  assert.equal(extractRobotsMeta(`<meta name="viewport" content="width=device-width">`), null);
}

function testExtractJsonLdBlocks() {
  const html = `<script type="application/ld+json">{"@type":"Place"}</script>`;
  assert.deepEqual(extractJsonLdBlocks(html), [`{"@type":"Place"}`]);
}

function testExtractJsonLdBlocksMultiple() {
  const html =
    `<script type="application/ld+json">{"a":1}</script>` +
    `<script type="application/ld+json">{"b":2}</script>`;
  assert.deepEqual(extractJsonLdBlocks(html), [`{"a":1}`, `{"b":2}`]);
}

function testCanonicalIssuesMissing() {
  assert.deepEqual(checkCanonicalIssues([], "https://mamago.by", 200), ["CANONICAL_MISSING"]);
}

function testCanonicalIssuesMultiple() {
  const issues = checkCanonicalIssues(
    ["https://mamago.by/a", "https://mamago.by/a"],
    "https://mamago.by",
    200,
  );
  assert.ok(issues.includes("CANONICAL_MULTIPLE"));
}

function testCanonicalIssuesWrongOrigin() {
  const issues = checkCanonicalIssues(["http://mamago.local:3000/places/foo"], "https://mamago.by", 200);
  assert.deepEqual(issues, ["CANONICAL_WRONG_ORIGIN"]);
}

function testCanonicalIssuesQueryHash() {
  const issues = checkCanonicalIssues(["https://mamago.by/places/foo?preview=1"], "https://mamago.by", 200);
  assert.deepEqual(issues, ["CANONICAL_HAS_QUERY_OR_HASH"]);
}

function testCanonicalIssuesValidNoIssues() {
  assert.deepEqual(checkCanonicalIssues(["https://mamago.by/places/foo"], "https://mamago.by", 200), []);
}

function testCanonicalIssuesSkippedForNon200() {
  // A redirect/404 page having no <link rel="canonical"> is not itself a P0 —
  // CANONICAL_MISSING only applies to pages that actually rendered 200.
  assert.deepEqual(checkCanonicalIssues([], "https://mamago.by", 404), []);
  assert.deepEqual(checkCanonicalIssues([], "https://mamago.by", 301), []);
}

function testCanonicalIssuesInvalidUrl() {
  assert.deepEqual(checkCanonicalIssues(["not a url"], "https://mamago.by", 200), ["CANONICAL_WRONG_ORIGIN"]);
}

function testRobotsContradictionDetected() {
  assert.equal(checkRobotsContradiction("noindex, nofollow", "index, follow"), true);
  assert.equal(checkRobotsContradiction("index, follow", "noindex, nofollow"), true);
}

function testRobotsContradictionAgreementNoContradiction() {
  assert.equal(checkRobotsContradiction("noindex, nofollow", "noindex, nofollow"), false);
  assert.equal(checkRobotsContradiction("index, follow", "index, follow"), false);
}

function testRobotsContradictionMissingOneSideIsNotAContradiction() {
  // Absence of a signal isn't itself a contradiction — only an explicit disagreement is.
  assert.equal(checkRobotsContradiction(null, "noindex"), false);
  assert.equal(checkRobotsContradiction("noindex", null), false);
  assert.equal(checkRobotsContradiction(null, null), false);
}

testExtractCanonicalSingle();
testExtractCanonicalNone();
testExtractCanonicalMultiple();
testExtractCanonicalAttributeOrderIndependent();
testExtractRobotsMeta();
testExtractRobotsMetaAttributeOrderIndependent();
testExtractRobotsMetaAbsent();
testExtractJsonLdBlocks();
testExtractJsonLdBlocksMultiple();
testCanonicalIssuesMissing();
testCanonicalIssuesMultiple();
testCanonicalIssuesWrongOrigin();
testCanonicalIssuesQueryHash();
testCanonicalIssuesValidNoIssues();
testCanonicalIssuesSkippedForNon200();
testCanonicalIssuesInvalidUrl();
testRobotsContradictionDetected();
testRobotsContradictionAgreementNoContradiction();
testRobotsContradictionMissingOneSideIsNotAContradiction();

console.log("verify-prelaunch-seo parser/rules tests: OK");
