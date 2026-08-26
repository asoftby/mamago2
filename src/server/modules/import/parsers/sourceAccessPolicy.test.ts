import assert from "node:assert/strict";

import {
  assertSourceRequestAllowed,
  clearSourceAccessPolicyCacheForTests,
  getActiveSourceFetchSettings,
  isPathAllowedByRobots,
  parseRobotsTxt,
  prepareSourceAccessContext,
  withSourceAccessContext,
} from "./sourceAccessPolicy";

function testRobotsParsingAndSpecificity() {
  const policy = parseRobotsTxt(`
User-agent: *
Disallow: /private/
Disallow: /afisha/admin
Allow: /afisha/admin/public$
Crawl-delay: 1.5

User-agent: SomeBot
Disallow: /
`);

  assert.equal(policy.crawlDelayMs, 1500);
  assert.equal(isPathAllowedByRobots(policy, "/afisha/123-event.html"), true);
  assert.equal(isPathAllowedByRobots(policy, "/private/secret"), false);
  assert.equal(isPathAllowedByRobots(policy, "/afisha/admin/test"), false);
  assert.equal(isPathAllowedByRobots(policy, "/afisha/admin/public"), true);
  assert.equal(isPathAllowedByRobots(policy, "/afisha/admin/public/child"), false);
}

async function testManagedSourceContext() {
  clearSourceAccessPolicyCacheForTests();

  const source = {
    slug: "family-by-afisha",
    parserKey: "family-by-afisha-event",
    baseUrl: "https://family.by/afisha/",
    fetchStrategy: "HTML_SCRAPE",
  } as never;

  let robotsFetches = 0;
  const context = await prepareSourceAccessContext(source, async (url) => {
    robotsFetches += 1;
    assert.equal(url, "https://family.by/robots.txt");
    return {
      status: 200,
      text: "User-agent: *\nDisallow: /afisha/private/\nCrawl-delay: 1\n",
    };
  });

  assert.ok(context);
  assert.equal(context.minRequestIntervalMs, 1000);
  assert.equal(robotsFetches, 1);

  await withSourceAccessContext(context, async () => {
    assert.doesNotThrow(() =>
      assertSourceRequestAllowed("https://family.by/afisha/123-event.html"),
    );
    assert.throws(
      () => assertSourceRequestAllowed("https://family.by/afisha/private/1.html"),
      /robots\.txt disallows/,
    );
    assert.throws(
      () => assertSourceRequestAllowed("https://example.com/afisha/1.html"),
      /Cross-origin HTML request blocked/,
    );

    const settings = getActiveSourceFetchSettings("https://family.by/afisha/123-event.html");
    assert.deepEqual(settings, {
      minRequestIntervalMs: 1000,
      cacheTtlMs: 5 * 60_000,
    });
  });

  const cachedContext = await prepareSourceAccessContext(source, async () => {
    robotsFetches += 1;
    throw new Error("robots cache should have been reused");
  });

  assert.ok(cachedContext);
  assert.equal(robotsFetches, 1);
}

async function testRobotsFailureIsFailClosed() {
  clearSourceAccessPolicyCacheForTests();

  const source = {
    slug: "family-by-afisha",
    parserKey: "family-by-afisha-event",
    baseUrl: "https://family.by/afisha/",
    fetchStrategy: "HTML_SCRAPE",
  } as never;

  await assert.rejects(
    () =>
      prepareSourceAccessContext(source, async () => {
        const error = Object.assign(new Error("Too Many Requests"), { status: 429 });
        throw error;
      }),
    /Cannot verify robots\.txt.*HTTP 429/,
  );
}

async function main() {
  testRobotsParsingAndSpecificity();
  await testManagedSourceContext();
  await testRobotsFailureIsFailClosed();
  console.log("sourceAccessPolicy tests: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
