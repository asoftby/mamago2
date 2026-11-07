/**
 * Role matrix for publishing Breaking News (admin article routes) and Places (business routes).
 *
 * The REAL route handlers run (auth guard, role policy, placeAccess, status gates). Only the
 * boundaries are replaced with in-memory fakes: the session (getCurrentUser), Prisma, business
 * membership permissions, and the services that perform the status transition. Assertions are on
 * actual HTTP status/body and on the resulting publication state, not on source text.
 *
 * Product decision: only ADMIN and MODERATOR publish without moderation. There is no EDITOR role.
 *
 * Запуск: npx tsx src/lib/auth/publicationRoleMatrix.http.test.ts
 */
import assert from "node:assert/strict";
import Module from "node:module";
import { NextRequest } from "next/server";

type Role = "USER" | "BUSINESS_OWNER" | "MODERATOR" | "ADMIN";
type TestUser = { id: string; role: Role };

// ── module mocking (CJS under tsx) ──────────────────────────────────────────────
const mocks = new Map<string, unknown>();
const loader = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
const originalLoad = loader._load;
loader._load = function (this: unknown, request: string, ...rest: unknown[]) {
  if (mocks.has(request)) return mocks.get(request);
  return originalLoad.call(this, request, ...rest);
};
const mockModule = (id: string, exports: Record<string, unknown>) => {
  mocks.set(id, { __esModule: true, ...exports });
};
/** Module whose every export is an async no-op unless overridden. */
const noopModule = (id: string, overrides: Record<string, unknown> = {}) => {
  const target: Record<string, unknown> = { __esModule: true, ...overrides };
  mocks.set(
    id,
    new Proxy(target, {
      get: (t, prop: string) => (prop in t ? t[prop] : async () => undefined),
    }),
  );
};

// ── in-memory state ─────────────────────────────────────────────────────────────
let currentUser: TestUser | null = null;

type PlaceRow = {
  id: string;
  title: string;
  category: string;
  shortDesc: string;
  logoImageId: string | null;
  lat: number | null;
  lng: number | null;
  locationSource: string | null;
  placeKind: string;
  parentPlaceId: string | null;
  floor: string | null;
  unit: string | null;
  status: string;
  createdByUserId: string;
  ownerBusinessId: string | null;
  archivedAt: Date | null;
  slug: string | null;
  images: { id: string; kind: string }[];
  updatedAt: Date;
  [key: string]: unknown;
};
const places = new Map<string, PlaceRow>();
const placeWrites: string[] = [];
const businesses = new Map<string, { verificationStatus: string }>();
/** userId → business membership permissions */
const memberships = new Map<string, { businessId: string; permissions: Set<string> }>();

const isStaff = (user: { role: string }) => user.role === "ADMIN" || user.role === "MODERATOR";

/** Delegate model: explicit handlers for what the routes assert on, benign defaults for the rest. */
const model = <T extends Record<string, unknown>>(handlers: T) =>
  new Proxy(handlers, {
    get: (t, prop: string) => {
      if (prop in t) return t[prop];
      if (prop === "findMany") return async () => [];
      if (prop === "count") return async () => 0;
      return async () => null;
    },
  });

const prismaFake = new Proxy(
  {
    place: model({
      findUnique: async ({ where }: { where: { id: string } }) => places.get(where.id) ?? null,
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `p-${places.size + 1}`,
          images: [],
          archivedAt: null,
          updatedAt: new Date(),
          ...data,
        } as unknown as PlaceRow;
        places.set(row.id, row);
        placeWrites.push(`create:${row.status}`);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        placeWrites.push(`update:${where.id}`);
        const row = places.get(where.id);
        if (row) Object.assign(row, data);
        return row ?? null;
      },
    }),
    business: model({
      findUnique: async ({ where }: { where: { id: string } }) => businesses.get(where.id) ?? null,
    }),
  } as Record<string, unknown>,
  { get: (t, prop: string) => (prop in t ? t[prop] : prop === "$transaction" ? passThroughTransaction : model({})) },
);
// The route lazily `import()`s the real slug service on publish (dynamic import bypasses the module
// mock), so the fake must also tolerate interactive transactions.
async function passThroughTransaction(fn: (tx: unknown) => unknown) {
  return typeof fn === "function" ? fn(prismaFake) : fn;
}

mockModule("@/lib/auth/server", { getCurrentUser: async () => currentUser });
mockModule("@/lib/prisma", { default: prismaFake, prisma: prismaFake });

const hasPermission = (userId: string, businessId: string, permission: string) => {
  const m = memberships.get(userId);
  return Boolean(m && m.businessId === businessId && m.permissions.has(permission));
};
class FakeBusinessAccessError extends Error {}
mockModule("@/server/permissions/business-permissions", {
  checkUserBusinessPermission: async (user: TestUser, businessId: string, permission: string) =>
    isStaff(user) || hasPermission(user.id, businessId, permission),
  checkBusinessToolPermission: async (user: TestUser, permission: string) =>
    isStaff(user) || (memberships.get(user.id)?.permissions.has(permission) ?? false),
  canAccessBusiness: async (userId: string, businessId: string) => memberships.get(userId)?.businessId === businessId,
  getPartnerCabinetBusiness: async (userId: string) => {
    const m = memberships.get(userId);
    return m ? { id: m.businessId } : null;
  },
  requireBusinessPermission: async (user: TestUser, businessId: string, permission: string) => {
    if (!isStaff(user) && !hasPermission(user.id, businessId, permission)) throw new FakeBusinessAccessError("denied");
  },
  nextResponseFromBusinessAccessError: (e: unknown) =>
    e instanceof FakeBusinessAccessError
      ? new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403, headers: { "content-type": "application/json" } })
      : null,
});

// State transitions are owned by services; the fakes mirror their contract (PUBLISHED vs PENDING).
const moderationCalls: string[] = [];
mockModule("@/server/services/moderation.service", {
  publishPlaceFromDraft: async (id: string) => {
    moderationCalls.push(`publish:${id}`);
    const row = places.get(id);
    if (row) row.status = "PUBLISHED";
  },
  submitPlace: async (id: string) => {
    moderationCalls.push(`submit:${id}`);
    const row = places.get(id);
    if (row) row.status = "PENDING";
  },
});
const adminNotifications: string[] = [];
mockModule("@/server/services/notification.service", {
  notifyAdminsPublicationSubmitted: async ({ publicationId }: { publicationId: string }) => {
    adminNotifications.push(publicationId);
  },
});
mockModule("@/lib/validation/placeCategoryValidation", {
  validatePlaceCategories: async () => ({ valid: true }),
  validatePlaceCategoriesDraft: async () => ({ valid: true }),
});
noopModule("@/lib/slug/placeSlugService", { generatePlaceSlug: async () => null, assignSlugOnPublish: async () => undefined });
noopModule("@/lib/media/mediaRegistry");
noopModule("@/lib/media/ensureMediaAssetForStoredFileUrl");
noopModule("@/server/services/media/media-usage.service");
noopModule("@/services/place/placeLocation.service");
noopModule("@/server/services/placeRevision.service", { getActiveRevision: async () => null });
noopModule("@/server/services/contentLifecycleOperation.service", {
  isContentLifecycleOperationError: () => false,
  assertContentLifecycleOperationAllowed: async () => undefined,
});

// Article service fake: same transition contract as articleAdminService.
type ArticleRow = { id: string; status: string };
const articles = new Map<string, ArticleRow>();
const articleCalls: string[] = [];
let listInvalidations = 0;
const snapshot = (id: string) => ({ id, status: articles.get(id)!.status });
mockModule("@/lib/article/articleAdminService", {
  createArticleFromSaveInput: async (input: { status: string }) => {
    articleCalls.push(`create:${input.status}`);
    const id = `a-${articles.size + 1}`;
    articles.set(id, { id, status: input.status });
    return snapshot(id);
  },
  saveArticleDraft: async (id: string, input: { status: string }) => {
    articleCalls.push(`save:${input.status}`);
    articles.get(id)!.status = input.status;
    return snapshot(id);
  },
  getArticleForEditor: async (id: string) => (articles.has(id) ? snapshot(id) : null),
  submitArticleForModeration: async (id: string) => {
    articleCalls.push("submit");
    articles.get(id)!.status = "PENDING";
    return snapshot(id);
  },
  moderateArticle: async (id: string, decision: "publish" | "reject") => {
    articleCalls.push(`moderate:${decision}`);
    articles.get(id)!.status = decision === "publish" ? "PUBLISHED" : "REJECTED";
    return snapshot(id);
  },
});
mockModule("@/server/article/publicArticleCache", { invalidatePublicArticleLists: () => { listInvalidations += 1; } });

// ── helpers ─────────────────────────────────────────────────────────────────────
const json = (method: string, url: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const idParams = (id: string) => ({ params: Promise.resolve({ id }) });
const readBody = async (res: Response) => (await res.json().catch(() => ({}))) as Record<string, unknown>;

const articleBody = (status: string) => ({
  title: "Breaking",
  slug: null,
  content: { version: 1, blocks: [] },
  coverImageId: null,
  status,
  publishedAt: null,
  scheduledAt: null,
  noindex: false,
});

function resetState() {
  currentUser = null;
  places.clear();
  placeWrites.length = 0;
  businesses.clear();
  memberships.clear();
  moderationCalls.length = 0;
  adminNotifications.length = 0;
  articles.clear();
  articleCalls.length = 0;
  listInvalidations = 0;
}

function validPlace(overrides: Partial<PlaceRow> = {}): PlaceRow {
  return {
    id: "place-1",
    title: "Олимпик",
    category: "other",
    shortDesc: "Описание",
    logoImageId: "logo-1",
    lat: 53.9,
    lng: 27.5,
    locationSource: "MANUAL",
    placeKind: "STANDALONE",
    parentPlaceId: null,
    floor: null,
    unit: null,
    status: "DRAFT",
    createdByUserId: "owner-1",
    ownerBusinessId: "biz-1",
    archivedAt: null,
    slug: null,
    images: [{ id: "logo-1", kind: "LOGO" }],
    updatedAt: new Date(),
    ...overrides,
  };
}

async function main() {
  const submitArticle = (await import("@/app/api/admin/articles/[id]/submit/route")).POST;
  const moderateArticle = (await import("@/app/api/admin/articles/[id]/moderate/route")).POST;
  const articlesRoute = await import("@/app/api/admin/articles/route");
  const articleByIdRoute = await import("@/app/api/admin/articles/[id]/route");
  const submitPlace = (await import("@/app/api/business/places/[id]/submit/route")).POST;
  const placesRoute = await import("@/app/api/business/places/route");
  const placeByIdRoute = await import("@/app/api/business/places/[id]/route");

  // ── 1. ADMIN / MODERATOR publish Breaking News directly ───────────────────────
  for (const role of ["ADMIN", "MODERATOR"] as const) {
    resetState();
    currentUser = { id: `${role}-1`, role };
    articles.set("a-1", { id: "a-1", status: "DRAFT" });
    const res = await submitArticle(json("POST", "/api/admin/articles/a-1/submit"), idParams("a-1"));
    assert.equal(res.status, 200, `${role}: submit responds 200`);
    assert.equal((await readBody(res)).status, "PUBLISHED", `${role}: response reports PUBLISHED`);
    assert.equal(articles.get("a-1")!.status, "PUBLISHED", `${role}: state is PUBLISHED, not PENDING`);
    assert.deepEqual(articleCalls, ["moderate:publish"], `${role}: no moderation-queue step`);
    assert.equal(listInvalidations, 1, `${role}: public lists refreshed after publish`);

    // ...and moderation decisions also work for staff
    articles.set("a-2", { id: "a-2", status: "PENDING" });
    const approved = await moderateArticle(json("POST", "/api/admin/articles/a-2/moderate", { decision: "publish" }), idParams("a-2"));
    assert.equal(approved.status, 200);
    assert.equal(articles.get("a-2")!.status, "PUBLISHED");
  }

  // ── 1b. ADMIN / MODERATOR publish their own Place directly ────────────────────
  for (const role of ["ADMIN", "MODERATOR"] as const) {
    resetState();
    currentUser = { id: `${role}-1`, role };
    places.set("place-1", validPlace({ createdByUserId: `${role}-1`, ownerBusinessId: null }));
    const res = await submitPlace(json("POST", "/api/business/places/place-1/submit", {}), idParams("place-1"));
    assert.equal(res.status, 200, `${role}: place submit 200`);
    assert.equal(places.get("place-1")!.status, "PUBLISHED", `${role}: place is PUBLISHED without moderation`);
    assert.deepEqual(moderationCalls, ["publish:place-1"]);
    assert.deepEqual(adminNotifications, [], `${role}: no moderation notification for self-published place`);

    // direct create with status PUBLISHED is accepted for staff
    const created = await placesRoute.POST(
      json("POST", "/api/business/places", {
        createRequestId: `req-${role}`,
        status: "PUBLISHED",
        data: { title: "Новое", category: "other", shortDesc: "Кратко" },
      }),
    );
    assert.equal(created.status, 200, `${role}: direct PUBLISHED create accepted`);
    assert.equal(((await readBody(created)).place as PlaceRow).status, "PUBLISHED");
  }

  // ── 2. USER / BUSINESS_OWNER have no access to admin Breaking News routes ─────
  for (const role of ["USER", "BUSINESS_OWNER"] as const) {
    resetState();
    currentUser = { id: `${role}-1`, role };
    articles.set("a-1", { id: "a-1", status: "DRAFT" });
    const attempts: [string, Response][] = [
      ["submit", await submitArticle(json("POST", "/api/admin/articles/a-1/submit"), idParams("a-1"))],
      ["moderate", await moderateArticle(json("POST", "/api/admin/articles/a-1/moderate", { decision: "publish" }), idParams("a-1"))],
      ["create", await articlesRoute.POST(json("POST", "/api/admin/articles", articleBody("PUBLISHED")))],
      ["save", await articleByIdRoute.PUT(json("PUT", "/api/admin/articles/a-1", articleBody("PUBLISHED")), idParams("a-1"))],
      ["read", await articleByIdRoute.GET(json("GET", "/api/admin/articles/a-1"), idParams("a-1"))],
    ];
    for (const [name, res] of attempts) assert.equal(res.status, 401, `${role}: ${name} is rejected`);
    assert.equal(articles.get("a-1")!.status, "DRAFT", `${role}: article state untouched`);
    assert.deepEqual(articleCalls, [], `${role}: the article service is never reached`);
    assert.equal(listInvalidations, 0);
  }
  resetState();
  currentUser = null;
  assert.equal((await submitArticle(json("POST", "/x"), idParams("a-1"))).status, 401, "anonymous is rejected");

  // ── 3. BUSINESS_OWNER: submit own place to moderation, never publish directly ─
  resetState();
  currentUser = { id: "owner-1", role: "BUSINESS_OWNER" };
  businesses.set("biz-1", { verificationStatus: "APPROVED" });
  memberships.set("owner-1", { businessId: "biz-1", permissions: new Set(["content.create", "content.update", "content.publish"]) });
  places.set("place-1", validPlace());
  const ownSubmit = await submitPlace(json("POST", "/api/business/places/place-1/submit", {}), idParams("place-1"));
  assert.equal(ownSubmit.status, 200);
  assert.equal(places.get("place-1")!.status, "PENDING", "owner's place waits for moderation");
  assert.deepEqual(moderationCalls, ["submit:place-1"], "goes through submitPlace, not publishPlaceFromDraft");
  assert.deepEqual(adminNotifications, ["place-1"], "moderators are notified");

  // direct PUBLISHED creation is refused with a validation error, and nothing is written
  const publishAttempt = await placesRoute.POST(
    json("POST", "/api/business/places", {
      createRequestId: "req-owner",
      status: "PUBLISHED",
      data: { title: "Новое", category: "other", shortDesc: "Кратко" },
    }),
  );
  assert.equal(publishAttempt.status, 400);
  assert.match(String((await readBody(publishAttempt)).message), /DRAFT or PENDING/);
  assert.ok(!placeWrites.some((w) => w.startsWith("create")), "no place row created for a forbidden direct publish");
  // submitting to moderation (PENDING) at creation is allowed
  const pendingCreate = await placesRoute.POST(
    json("POST", "/api/business/places", {
      createRequestId: "req-owner-2",
      status: "PENDING",
      data: { title: "Новое", category: "other", shortDesc: "Кратко" },
    }),
  );
  assert.equal(pendingCreate.status, 200);
  assert.equal(((await readBody(pendingCreate)).place as PlaceRow).status, "PENDING");

  // owner without content.publish cannot even submit
  resetState();
  currentUser = { id: "owner-1", role: "BUSINESS_OWNER" };
  businesses.set("biz-1", { verificationStatus: "APPROVED" });
  memberships.set("owner-1", { businessId: "biz-1", permissions: new Set(["content.update"]) });
  places.set("place-1", validPlace());
  const noPublishPerm = await submitPlace(json("POST", "/x", {}), idParams("place-1"));
  assert.equal(noPublishPerm.status, 403);
  assert.equal((await readBody(noPublishPerm)).code, "BUSINESS_CONTENT_PUBLISH_FORBIDDEN");
  assert.equal(places.get("place-1")!.status, "DRAFT");

  // unverified business cannot submit
  resetState();
  currentUser = { id: "owner-1", role: "BUSINESS_OWNER" };
  businesses.set("biz-1", { verificationStatus: "PENDING" });
  memberships.set("owner-1", { businessId: "biz-1", permissions: new Set(["content.update", "content.publish"]) });
  places.set("place-1", validPlace());
  const unverified = await submitPlace(json("POST", "/x", {}), idParams("place-1"));
  assert.equal(unverified.status, 403);
  assert.equal((await readBody(unverified)).code, "BUSINESS_NOT_APPROVED");
  assert.equal(places.get("place-1")!.status, "DRAFT");

  // ── 4. Saving a DRAFT never publishes ─────────────────────────────────────────
  for (const role of ["ADMIN", "MODERATOR"] as const) {
    resetState();
    currentUser = { id: `${role}-1`, role };
    const created = await articlesRoute.POST(json("POST", "/api/admin/articles", articleBody("DRAFT")));
    assert.equal(created.status, 200);
    assert.equal((await readBody(created)).status, "DRAFT", `${role}: new draft stays DRAFT`);
    assert.equal(listInvalidations, 0, `${role}: no public-list refresh for a draft`);
    const saved = await articleByIdRoute.PUT(json("PUT", "/api/admin/articles/a-1", articleBody("DRAFT")), idParams("a-1"));
    assert.equal(saved.status, 200);
    assert.equal(articles.get("a-1")!.status, "DRAFT", `${role}: saving a draft does not publish`);
    assert.ok(!articleCalls.some((c) => c.startsWith("moderate")), `${role}: no publish transition on save`);

    // draft Place creation keeps DRAFT even for staff
    const draftPlace = await placesRoute.POST(
      json("POST", "/api/business/places", { createRequestId: `draft-${role}`, status: "DRAFT", data: { title: "Черновик" } }),
    );
    assert.equal(draftPlace.status, 200);
    assert.equal(((await readBody(draftPlace)).place as PlaceRow).status, "DRAFT", `${role}: draft place stays DRAFT`);
    assert.deepEqual(moderationCalls, [], `${role}: draft place save never calls publish/submit`);
  }
  resetState();
  currentUser = { id: "owner-1", role: "BUSINESS_OWNER" };
  memberships.set("owner-1", { businessId: "biz-1", permissions: new Set(["content.create"]) });
  const ownerDraft = await placesRoute.POST(
    json("POST", "/api/business/places", { createRequestId: "draft-owner", status: "DRAFT", data: { title: "Черновик" } }),
  );
  assert.equal(ownerDraft.status, 200);
  assert.equal(((await readBody(ownerDraft)).place as PlaceRow).status, "DRAFT");

  // ── 5. A foreign business user cannot modify or submit someone else's place ───
  resetState();
  currentUser = { id: "intruder-1", role: "BUSINESS_OWNER" };
  businesses.set("biz-2", { verificationStatus: "APPROVED" });
  memberships.set("intruder-1", {
    businessId: "biz-2",
    permissions: new Set(["content.create", "content.update", "content.publish"]),
  });
  businesses.set("biz-1", { verificationStatus: "APPROVED" });
  places.set("place-1", validPlace({ ownerBusinessId: "biz-1", createdByUserId: "owner-1" }));
  const foreignSubmit = await submitPlace(json("POST", "/api/business/places/place-1/submit", {}), idParams("place-1"));
  assert.equal(foreignSubmit.status, 403, "foreign business cannot submit");
  const foreignPatch = await placeByIdRoute.PATCH(json("PATCH", "/api/business/places/place-1", { title: "Взломано" }), idParams("place-1"));
  assert.equal(foreignPatch.status, 403, "foreign business cannot edit");
  assert.equal(places.get("place-1")!.status, "DRAFT", "status untouched");
  assert.equal(places.get("place-1")!.title, "Олимпик", "title untouched");
  assert.deepEqual(moderationCalls, []);
  assert.deepEqual(adminNotifications, []);
  assert.deepEqual(placeWrites, [], "no write reached the database");

  // legacy place without a business: only its creator, not another user
  places.set("place-2", validPlace({ id: "place-2", ownerBusinessId: null, createdByUserId: "owner-1" }));
  assert.equal((await submitPlace(json("POST", "/x", {}), idParams("place-2"))).status, 403);
  assert.equal(places.get("place-2")!.status, "DRAFT");

  // staff can still act on any place (regression guard for the policy)
  currentUser = { id: "MODERATOR-1", role: "MODERATOR" };
  assert.equal((await submitPlace(json("POST", "/x", {}), idParams("place-2"))).status, 200);
  assert.equal(places.get("place-2")!.status, "PUBLISHED");

  console.log("publicationRoleMatrix.http.test.ts: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
