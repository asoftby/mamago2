import assert from "node:assert/strict";

import {
  getPublicBaseFromHost,
  resolveSubdomainMiddlewareDecision,
} from "./subdomainMiddleware.ts";

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
    kind: "redirect",
    location: "https://mamago.by/editor/place/new",
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

console.log("subdomain middleware tests: OK");
