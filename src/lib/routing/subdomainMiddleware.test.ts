import assert from "node:assert/strict";
import { businessNavigation } from "../business/navigation";
import { buildClientCompatibleDestination } from "./clientNavigation";

import {
  getPublicBaseFromHost,
  resolveSubdomainMiddlewareDecision,
} from "./subdomainMiddleware";
import {
  removeTrailingSlash,
  shouldSkipTrailingSlashRedirect,
} from "./trailingSlashPolicy";

function resolvePreviewLifecycle(host: string, pathname: string) {
  const visitedExternalPaths = new Set<string>();
  let externalPathname = pathname;

  for (let step = 0; step < 5; step += 1) {
    assert.equal(
      visitedExternalPaths.has(externalPathname),
      false,
      `redirect cycle detected for ${host}${pathname} at ${externalPathname}`,
    );
    visitedExternalPaths.add(externalPathname);

    if (
      externalPathname.endsWith("/") &&
      !shouldSkipTrailingSlashRedirect(externalPathname)
    ) {
      externalPathname = removeTrailingSlash(externalPathname);
      continue;
    }

    const decision = resolveSubdomainMiddlewareDecision({
      host,
      protocol: "https:",
      pathname: externalPathname,
      search: "",
    });

    if (decision.kind === "redirect") {
      externalPathname = new URL(decision.location).pathname;
      continue;
    }

    return { decision, externalPathname, steps: step + 1 };
  }

  assert.fail(`preview lifecycle did not resolve for ${host}${pathname}`);
}

for (const [host, expectedInternalPath] of [
  ["admin.dev.mamago.by", "/admin"],
  ["admin.prod.mamago.by", "/admin"],
  ["business.dev.mamago.by", "/business"],
  ["business.prod.mamago.by", "/business"],
] as const) {
  const result = resolvePreviewLifecycle(host, "/");
  assert.deepEqual(result.decision, { kind: "rewrite", pathname: expectedInternalPath });
  assert.equal(result.externalPathname, "/");
}

const prefixedAdminRoot = resolvePreviewLifecycle("admin.dev.mamago.by", "/admin");
assert.deepEqual(prefixedAdminRoot.decision, { kind: "rewrite", pathname: "/admin" });
assert.equal(prefixedAdminRoot.externalPathname, "/");

assert.deepEqual(
  resolvePreviewLifecycle("admin.dev.mamago.by", "/ranking").decision,
  { kind: "rewrite", pathname: "/admin/ranking" },
);

assert.equal(
  getPublicBaseFromHost("business.mamago.local:3002", "http:"),
  "http://mamago.local:3002",
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "business.mamago.by",
    protocol: "https:",
    pathname: "/business/dashboard",
    search: "",
  }),
  {
    kind: "redirect",
    location: "https://business.mamago.by/dashboard",
  },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.by",
    protocol: "https:",
    pathname: "/admin/ranking",
    search: "",
  }),
  {
    kind: "redirect",
    location: "https://admin.mamago.by/ranking",
  },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "business.mamago.by",
    protocol: "https:",
    pathname: "/editor/place/new",
    search: "",
  }),
  {
    kind: "next",
  },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.by",
    protocol: "https:",
    pathname: "/editor/event/evt_123/edit",
    search: "?returnTo=%2Fadmin%2Fimport%2Freview",
  }),
  {
    kind: "next",
  },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.by",
    protocol: "https:",
    pathname: "/login",
    search: "",
  }),
  {
    kind: "redirect",
    location: "https://mamago.by/login",
  },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "business.mamago.by",
    protocol: "https:",
    pathname: "/dashboard",
    search: "",
  }),
  {
    kind: "rewrite",
    pathname: "/business/dashboard",
  },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.by",
    protocol: "https:",
    pathname: "/dashboard",
    search: "",
  }),
  {
    kind: "redirect",
    location: "https://admin.mamago.by/",
  },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.by",
    protocol: "https:",
    pathname: "/admin/dashboard",
    search: "",
  }),
  {
    kind: "redirect",
    location: "https://admin.mamago.by/",
  },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.by",
    protocol: "https:",
    pathname: "/ranking",
    search: "",
  }),
  {
    kind: "rewrite",
    pathname: "/admin/ranking",
  },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.by",
    protocol: "https:",
    pathname: "/admin/login",
    search: "",
  }),
  {
    kind: "redirect",
    location: "https://admin.mamago.by/login",
  },
);

// Route (маршрут) view/create/edit — shared RouteEditor wizard opened from
// the admin content list must stay on the admin/business surface instead of
// being rewritten into a nonexistent /admin/routes/* or /business/routes/*.
assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.local",
    protocol: "https:",
    pathname: "/routes/family-picnic/edit",
    search: "",
  }),
  { kind: "next" },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.local",
    protocol: "https:",
    pathname: "/routes/family-picnic",
    search: "",
  }),
  { kind: "next" },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "business.mamago.local",
    protocol: "https:",
    pathname: "/routes/new",
    search: "",
  }),
  { kind: "next" },
);

// Content preview routes (/me/{places|offers|events}/{id}/preview) — opened
// as a relative link from the admin content list — must stay on the current
// subdomain surface instead of being rewritten into a nonexistent
// /admin/me/* or /business/me/* page (404).
assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.by",
    protocol: "https:",
    pathname: "/me/places/cmrnagtxy000hwsr2hy4843rk/preview",
    search: "",
  }),
  { kind: "next" },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.by",
    protocol: "https:",
    pathname: "/me/offers/off_123/preview",
    search: "",
  }),
  { kind: "next" },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.by",
    protocol: "https:",
    pathname: "/me/events/evt_123/preview",
    search: "",
  }),
  { kind: "next" },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "business.mamago.by",
    protocol: "https:",
    pathname: "/me/places/cmrnagtxy000hwsr2hy4843rk/preview",
    search: "",
  }),
  { kind: "next" },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "business.mamago.by",
    protocol: "https:",
    pathname: "/me/offers/off_123/preview",
    search: "",
  }),
  { kind: "next" },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "business.mamago.by",
    protocol: "https:",
    pathname: "/me/events/evt_123/preview",
    search: "",
  }),
  { kind: "next" },
);

// Article editorial preview lives in the public route group but must remain
// reachable on the admin host. Keep this exact-format only: no blanket
// /preview/* bypass and no automatic business-host allowance.
for (const host of ["admin.mamago.local", "admin.mamago.by"]) {
  assert.deepEqual(
    resolveSubdomainMiddlewareDecision({
      host,
      protocol: host.endsWith(".local") ? "http:" : "https:",
      pathname: "/preview/articles/article-id",
      search: "",
    }),
    { kind: "next" },
  );
}

for (const pathname of [
  "/preview/articles",
  "/preview/articles/",
  "/preview/articles/id/extra",
  "/preview/other/id",
]) {
  assert.deepEqual(
    resolveSubdomainMiddlewareDecision({
      host: "admin.mamago.local",
      protocol: "http:",
      pathname,
      search: "",
    }),
    { kind: "rewrite", pathname: `/admin${pathname}` },
  );
}

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "business.mamago.by",
    protocol: "https:",
    pathname: "/preview/articles/article-id",
    search: "",
  }),
  { kind: "rewrite", pathname: "/business/preview/articles/article-id" },
);

// Deliberately narrow — not a blanket /me/* bypass. Ordinary /me/... routes
// (dashboard, settings, anything not matching the exact preview format)
// must keep going through the normal admin/business rewrite.
assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.by",
    protocol: "https:",
    pathname: "/me/places",
    search: "",
  }),
  { kind: "rewrite", pathname: "/admin/me/places" },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.by",
    protocol: "https:",
    pathname: "/me/settings",
    search: "",
  }),
  { kind: "rewrite", pathname: "/admin/me/settings" },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.by",
    protocol: "https:",
    pathname: "/me/places/cmrnagtxy000hwsr2hy4843rk",
    search: "",
  }),
  { kind: "rewrite", pathname: "/admin/me/places/cmrnagtxy000hwsr2hy4843rk" },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.by",
    protocol: "https:",
    pathname: "/me/places/cmrnagtxy000hwsr2hy4843rk/preview/extra",
    search: "",
  }),
  { kind: "rewrite", pathname: "/admin/me/places/cmrnagtxy000hwsr2hy4843rk/preview/extra" },
);

// Regression: /editor/* and /routes/* pass-through behavior is unaffected
// by the new preview-route check.
assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.by",
    protocol: "https:",
    pathname: "/editor/place/cmrnagtxy000hwsr2hy4843rk/edit",
    search: "",
  }),
  { kind: "next" },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "business.mamago.by",
    protocol: "https:",
    pathname: "/routes/family-picnic/edit",
    search: "",
  }),
  { kind: "next" },
);

// Regression: routes are the only new pass-through — everything else on the
// admin/business surface still rewrites/redirects exactly as before.
assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.local",
    protocol: "https:",
    pathname: "/moderation",
    search: "",
  }),
  { kind: "rewrite", pathname: "/admin/moderation" },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "business.mamago.local",
    protocol: "https:",
    pathname: "/places",
    search: "",
  }),
  { kind: "rewrite", pathname: "/business/places" },
);

// Current Traefik hosts (dev.mamago.by / prod.mamago.by) must not fall through
// to the public `/` → `/minsk` rewrite. Apex mamago.by stays unchanged.
assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.dev.mamago.by",
    protocol: "https:",
    pathname: "/",
    search: "",
  }),
  { kind: "rewrite", pathname: "/admin" },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.prod.mamago.by",
    protocol: "https:",
    pathname: "/ranking",
    search: "",
  }),
  { kind: "rewrite", pathname: "/admin/ranking" },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "business.dev.mamago.by",
    protocol: "https:",
    pathname: "/dashboard",
    search: "",
  }),
  { kind: "rewrite", pathname: "/business/dashboard" },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "business.prod.mamago.by",
    protocol: "https:",
    pathname: "/places",
    search: "",
  }),
  { kind: "rewrite", pathname: "/business/places" },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "prod.mamago.by",
    protocol: "https:",
    pathname: "/",
    search: "",
  }),
  {
    kind: "redirect",
    location: "https://prod.mamago.by/minsk",
  },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.by",
    protocol: "https:",
    pathname: "/ranking",
    search: "",
  }),
  { kind: "rewrite", pathname: "/admin/ranking" },
);

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "admin.mamago.local",
    protocol: "https:",
    pathname: "/register",
    search: "",
  }),
  {
    kind: "redirect",
    location: "https://mamago.local/register",
  },
);

// Business sidebar opens the shared user inbox on the public host, not a
// non-existent /business/me/direct URL. Both list and legacy thread links work.
for (const [host, expectedUrl] of [
  ["business.mamago.by", "https://mamago.by/me/direct"],
  ["business.dev.mamago.by", "https://dev.mamago.by/me/direct"],
  ["business.prod.mamago.by", "https://prod.mamago.by/me/direct"],
] as const) {
  assert.deepEqual(
    resolveSubdomainMiddlewareDecision({
      host,
      protocol: "https:",
      pathname: "/direct",
      search: "",
    }),
    { kind: "redirect", location: expectedUrl },
  );
}

assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "business.dev.mamago.by",
    protocol: "https:",
    pathname: "/direct/test-thread-123",
    search: "?from=notification",
  }),
  {
    kind: "redirect",
    location: "https://dev.mamago.by/me/direct/test-thread-123?from=notification",
  },
);

// Unhydrated links on the business host must work as well. Client navigation
// already resolves the same link to an absolute public-host destination.
assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "business.dev.mamago.by",
    protocol: "https:",
    pathname: "/me/direct",
    search: "",
    publicAppUrl: "https://mamago.by",
  }),
  { kind: "redirect", location: "https://dev.mamago.by/me/direct" },
);
assert.deepEqual(
  resolveSubdomainMiddlewareDecision({
    host: "business.mamago.by",
    protocol: "https:",
    pathname: "/me/direct/thread-456",
    search: "",
  }),
  { kind: "redirect", location: "https://mamago.by/me/direct/thread-456" },
);

// Business navigation: dashboard is the first task, messages next, support
// remains available, and settings is distinct rather than duplicated help.
const businessMenuLabels = businessNavigation.map(({ label }) => label);
assert.equal(businessMenuLabels[0], "Панель управления");
assert.equal(businessMenuLabels[1], "Сообщения");
const messagesHref = businessNavigation.find(({ label }) => label === "Сообщения");
assert.equal(messagesHref?.type, "item");
assert.equal(messagesHref?.type === "item" ? messagesHref.href : null, "/me/direct");
assert.equal(
  buildClientCompatibleDestination("/me/direct", {
    currentHost: "business.dev.mamago.by",
    currentProtocol: "https",
  }),
  "https://dev.mamago.by/me/direct",
);
assert.equal(businessMenuLabels.at(-2), "Поддержка mamaGo");
assert.equal(businessMenuLabels.at(-1), "Настройки");
assert.equal(businessMenuLabels.includes("Настройки и помощь"), false);

console.log("subdomain middleware tests: OK");
