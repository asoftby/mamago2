import assert from "node:assert/strict";
import robots, { dynamic } from "./robots";

const previous = {
  SITE_INDEXING_ENABLED: process.env.SITE_INDEXING_ENABLED,
  SITE_NOINDEX_FORCE: process.env.SITE_NOINDEX_FORCE,
  SITE_NOINDEX_DEFAULT: process.env.SITE_NOINDEX_DEFAULT,
  APP_PUBLIC_URL: process.env.APP_PUBLIC_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
};

function clearIndexingEnv() {
  delete process.env.SITE_INDEXING_ENABLED;
  delete process.env.SITE_NOINDEX_FORCE;
  delete process.env.SITE_NOINDEX_DEFAULT;
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  process.env.APP_PUBLIC_URL = "https://mamago.by";
}

try {
  assert.equal(dynamic, "force-dynamic", "robots.txt must stay runtime-switchable");

  clearIndexingEnv();
  assert.deepEqual(robots(), {
    rules: { userAgent: "*", disallow: "/" },
  });

  process.env.SITE_INDEXING_ENABLED = "true";
  assert.deepEqual(robots(), {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://mamago.by/sitemap.xml",
  });

  process.env.SITE_NOINDEX_FORCE = "true";
  assert.deepEqual(robots(), {
    rules: { userAgent: "*", disallow: "/" },
  });

  console.log("robots runtime gate tests: OK");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
