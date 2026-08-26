import assert from "node:assert/strict";

import {
  clearFetchHtmlPolicyStateForTests,
  fetchHtml,
} from "./fetchHtml";
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

async function makeFamilyContext() {
  const source = {
    slug: "family-by-afisha",
    parserKey: "family-by-afisha-event",
    baseUrl: "https://family.by/afisha/",
    fetchStrategy: "HTML_SCRAPE",
  } as never;

  return prepareSourceAccessContext(source, async (url) => {
    assert.equal(url, "https://family.by/robots.txt");
    return {
      status: 200,
      text: "User-agent: *\nDisallow: /afisha/private/\nCrawl-delay: 1\n",
    };
  });
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

async function testManagedFetchCachesAndAvoidsIdentifyingHeaders() {
  clearSourceAccessPolicyCacheForTests();
  clearFetchHtmlPolicyStateForTests();
  const context = await makeFamilyContext();
  assert.ok(context);

  const originalFetch = globalThis.fetch;
  let calls = 0;
  let observedHeaders: Headers | null = null;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    observedHeaders = new Headers(init?.headers);
    return new Response("<html>ok</html>", { status: 200 });
  }) as typeof fetch;

  try {
    await withSourceAccessContext(context, async () => {
      const options = {
        retries: 1,
        nodeHttpFallback: false,
        minRequestIntervalMs: 0,
        cacheTtlMs: 60_000,
      } as const;
      await fetchHtml("https://family.by/afisha/123-event.html", options);
      await fetchHtml("https://family.by/afisha/123-event.html", options);
    });
  } finally {
    globalThis.fetch = originalFetch;
    clearFetchHtmlPolicyStateForTests();
  }

  assert.equal(calls, 1, "the second identical HTML request must use the source-aware cache");
  assert.ok(observedHeaders);
  assert.equal(observedHeaders.get("cache-control"), null);
  assert.equal(observedHeaders.get("pragma"), null);
  assert.doesNotMatch(observedHeaders.get("user-agent") ?? "", /mamago/i);
}

async function test429IsNotRetried() {
  clearFetchHtmlPolicyStateForTests();
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("rate limited", { status: 429, statusText: "Too Many Requests" });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        fetchHtml("https://example.com/rate-limited", {
          retries: 3,
          retryDelayMs: 0,
          nodeHttpFallback: false,
        }),
      /status 429/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    clearFetchHtmlPolicyStateForTests();
  }

  assert.equal(calls, 1, "HTTP 429 must not be retried automatically");
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
  await testManagedFetchCachesAndAvoidsIdentifyingHeaders();
  await test429IsNotRetried();
  await testRobotsFailureIsFailClosed();
  console.log("sourceAccessPolicy tests: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
