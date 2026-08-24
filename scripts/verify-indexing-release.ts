/**
 * Two-phase, read-only SEO gate for opening production indexing.
 *
 * Closed phase (default): verifies the release gate is still fail-closed.
 * Open phase: verifies robots/sitemap are open while permanent noindex pages
 * remain protected and every sitemap URL is a direct, canonical, indexable 200.
 *
 * Examples:
 *   npx tsx scripts/verify-indexing-release.ts \
 *     --base-url https://mamago.by --expected-origin https://mamago.by --expect-indexing closed
 *
 *   npx tsx scripts/verify-indexing-release.ts \
 *     --base-url https://mamago.by --expected-origin https://mamago.by --expect-indexing open \
 *     --legacy-preview-url https://prod.mamago.by
 */

function argValue(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index === process.argv.length - 1) return fallback;
  return process.argv[index + 1];
}

function isEntryModule(): boolean {
  return import.meta.url === `file://${process.argv[1]}`;
}

export function extractSitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1].trim());
}

export function extractCanonical(html: string): string | null {
  const tags = [...html.matchAll(/<link\b[^>]*\brel=["']canonical["'][^>]*>/giu)];
  if (tags.length !== 1) return null;
  return tags[0][0].match(/\bhref=["']([^"']+)["']/iu)?.[1] ?? null;
}

export function extractRobotsMeta(html: string): string | null {
  const direct = html.match(
    /<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["']([^"']+)["']/iu,
  );
  if (direct) return direct[1];
  return (
    html.match(
      /<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\bname=["']robots["']/iu,
    )?.[1] ?? null
  );
}

export function hasNoindexDirective(...values: Array<string | null | undefined>): boolean {
  return values.some((value) => value?.toLowerCase().includes("noindex") === true);
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  if (parsed.pathname !== "/") parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
  return parsed.toString();
}

async function fetchManual(url: string): Promise<Response> {
  return fetch(url, {
    redirect: "manual",
    headers: { "user-agent": "mamaGo-indexing-release-verifier/1.0" },
  });
}

async function fetchHtml(url: string): Promise<{ response: Response; html: string }> {
  const response = await fetchManual(url);
  const html = (response.headers.get("content-type") ?? "").includes("text/html")
    ? await response.text()
    : "";
  return { response, html };
}

function assertCondition(condition: unknown, message: string, failures: string[]) {
  if (!condition) failures.push(message);
}

async function checkPermanentNoindex(
  baseUrl: string,
  pathname: string,
  failures: string[],
): Promise<void> {
  const { response, html } = await fetchHtml(`${baseUrl}${pathname}`);
  assertCondition(
    response.status === 200 || response.status === 401 || response.status === 403,
    `${pathname}: expected 200/401/403, got ${response.status}`,
    failures,
  );
  const meta = extractRobotsMeta(html);
  const header = response.headers.get("x-robots-tag");
  assertCondition(
    hasNoindexDirective(meta, header),
    `${pathname}: permanent noindex missing (meta=${meta ?? "none"}, x-robots=${header ?? "none"})`,
    failures,
  );
}

async function main() {
  const baseUrl = (argValue("base-url") ?? "").replace(/\/+$/u, "");
  const expectedOrigin = (argValue("expected-origin") ?? baseUrl).replace(/\/+$/u, "");
  const phase = argValue("expect-indexing", "closed");
  const legacyPreviewUrl = argValue("legacy-preview-url")?.replace(/\/+$/u, "");
  const maxUrls = Number(argValue("max-urls", "300"));

  if (!baseUrl || !expectedOrigin || (phase !== "closed" && phase !== "open")) {
    console.error(
      "Usage: verify-indexing-release.ts --base-url <url> --expected-origin <url> --expect-indexing <closed|open> [--legacy-preview-url <url>] [--max-urls 300]",
    );
    process.exitCode = 2;
    return;
  }

  const failures: string[] = [];

  const robotsResponse = await fetchManual(`${baseUrl}/robots.txt`);
  const robotsText = await robotsResponse.text();
  assertCondition(robotsResponse.status === 200, `robots.txt: expected 200, got ${robotsResponse.status}`, failures);

  const sitemapResponse = await fetchManual(`${baseUrl}/sitemap.xml`);
  const sitemapXml = await sitemapResponse.text();
  assertCondition(sitemapResponse.status === 200, `sitemap.xml: expected 200, got ${sitemapResponse.status}`, failures);
  const sitemapUrls = extractSitemapUrls(sitemapXml);

  if (phase === "closed") {
    assertCondition(/Disallow:\s*\//iu.test(robotsText), "robots.txt: Disallow: / missing while indexing must be closed", failures);
    assertCondition(sitemapUrls.length === 0, `sitemap.xml: expected 0 URLs while closed, got ${sitemapUrls.length}`, failures);

    const { response, html } = await fetchHtml(`${baseUrl}/minsk`);
    assertCondition(response.status === 200, `/minsk: expected 200, got ${response.status}`, failures);
    assertCondition(
      hasNoindexDirective(extractRobotsMeta(html), response.headers.get("x-robots-tag")),
      "/minsk: global noindex missing while indexing is closed",
      failures,
    );
  } else {
    assertCondition(/Allow:\s*\//iu.test(robotsText), "robots.txt: Allow: / missing after opening indexing", failures);
    assertCondition(!/Disallow:\s*\//iu.test(robotsText), "robots.txt: Disallow: / still present after opening indexing", failures);
    assertCondition(
      robotsText.includes(`${expectedOrigin}/sitemap.xml`),
      `robots.txt: canonical sitemap ${expectedOrigin}/sitemap.xml missing`,
      failures,
    );
    assertCondition(sitemapUrls.length > 0, "sitemap.xml: must be non-empty after opening indexing", failures);
    assertCondition(
      sitemapUrls.length === new Set(sitemapUrls).size,
      "sitemap.xml: duplicate URLs found",
      failures,
    );

    for (const url of sitemapUrls.slice(0, maxUrls)) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        failures.push(`sitemap URL is not absolute: ${url}`);
        continue;
      }
      assertCondition(parsed.origin === expectedOrigin, `sitemap wrong origin: ${url}`, failures);

      const { response, html } = await fetchHtml(url);
      assertCondition(response.status === 200, `sitemap URL must be direct 200: ${url} -> ${response.status}`, failures);
      const meta = extractRobotsMeta(html);
      const header = response.headers.get("x-robots-tag");
      assertCondition(
        !hasNoindexDirective(meta, header),
        `sitemap URL is noindex: ${url} (meta=${meta ?? "none"}, x-robots=${header ?? "none"})`,
        failures,
      );

      const canonical = extractCanonical(html);
      assertCondition(canonical !== null, `canonical missing or multiple: ${url}`, failures);
      if (canonical) {
        assertCondition(new URL(canonical).origin === expectedOrigin, `canonical wrong origin: ${url} -> ${canonical}`, failures);
        assertCondition(normalizeUrl(canonical) === normalizeUrl(url), `canonical mismatch: ${url} -> ${canonical}`, failures);
      }
    }
  }

  // These must stay noindex in BOTH phases.
  await checkPermanentNoindex(baseUrl, "/login", failures);
  await checkPermanentNoindex(baseUrl, "/minsk/birthday", failures);

  if (legacyPreviewUrl) {
    const probePath = "/minsk/events";
    const response = await fetchManual(`${legacyPreviewUrl}${probePath}`);
    assertCondition(response.status === 301, `legacy PROD host: expected 301, got ${response.status}`, failures);
    const location = response.headers.get("location");
    assertCondition(
      location === `${expectedOrigin}${probePath}`,
      `legacy PROD host: expected ${expectedOrigin}${probePath}, got ${location ?? "no Location"}`,
      failures,
    );
  }

  const summary = {
    phase,
    baseUrl,
    expectedOrigin,
    sitemapUrlCount: sitemapUrls.length,
    crawledUrlCount: phase === "open" ? Math.min(sitemapUrls.length, maxUrls) : 0,
    failureCount: failures.length,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (failures.length > 0) {
    console.error("\nINDEXING RELEASE GATE: FAIL");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log("\nINDEXING RELEASE GATE: PASS");
  }
}

if (isEntryModule()) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
