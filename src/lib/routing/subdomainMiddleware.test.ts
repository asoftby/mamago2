import assert from "node:assert/strict";

import {
  getPublicBaseFromHost,
  resolveSubdomainMiddlewareDecision,
} from "./subdomainMiddleware";

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

console.log("subdomain middleware tests: OK");
