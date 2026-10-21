/**
 * Route-level smoke for the collections API: real handlers, real DB, real
 * sessions. `next/headers` is stubbed (cookies() needs a Next request scope);
 * everything else - getCurrentUser, validateSession, handlers - is the real code.
 *
 * Run: NODE_OPTIONS=--conditions=react-server tsx src/app/api/collections/collections.routes.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Module from "node:module";

let sessionToken: string | null = null;
let sessionCookieName: string | null = null;

type Loader = (request: string, parent: unknown, isMain: boolean) => unknown;
const mod = Module as unknown as { _load: Loader };
const originalLoad = mod._load;
mod._load = function patchedLoad(request, parent, isMain) {
  if (request === "next/headers") {
    return {
      cookies: async () => ({ get: (name: string) => (name === sessionCookieName && sessionToken ? { name, value: sessionToken } : undefined) }),
      headers: async () => new Headers(),
    };
  }
  if (request === "next/navigation") {
    // Imported by auth/server.ts (requireUser redirect); never reached by these handlers.
    const unreachable = () => { throw new Error("next/navigation must not be called in this test"); };
    return { redirect: unreachable, notFound: unreachable, permanentRedirect: unreachable };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const marker = randomUUID();
const userIds: string[] = [];

function json(url: string, method: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { createSession } = await import("@/lib/auth/session");
  // Import only after the next/headers stub is installed.
  const { SESSION_COOKIE_NAME } = await import("@/lib/auth/cookie");
  sessionCookieName = SESSION_COOKIE_NAME;
  const collectionsRoute = await import("./route");
  const collectionRoute = await import("./[id]/route");
  const ideaCollectionsRoute = await import("../save/idea/collections/route");
  const saveIdeaRoute = await import("../save/idea/route");
  const { NextRequest } = await import("next/server");
  const req = (url: string, method: string, body?: unknown) => new NextRequest(json(url, method, body));
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  async function createUser(label: string) {
    const user = await prisma.user.create({ data: { email: `collections-routes-${label}-${marker}@example.invalid` }, select: { id: true } });
    userIds.push(user.id);
    return { id: user.id, token: await createSession(user.id) };
  }

  try {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const aliceActivity = `act-alice-${marker}`;
    const bobActivity = `act-bob-${marker}`;
    await prisma.idea.create({ data: { userId: alice.id, activityId: aliceActivity } });
    await prisma.idea.create({ data: { userId: bob.id, activityId: bobActivity } });

    // Bob's collection, created through the API as Bob.
    sessionToken = bob.token;
    const bobCreate = await collectionsRoute.POST(req("/api/collections", "POST", { title: "Bob only" }));
    assert.equal(bobCreate.status, 201);
    const bobCollectionId = (await bobCreate.json()).collection.id as string;

    // --- no session -> 401 on every endpoint
    sessionToken = null;
    assert.equal((await collectionsRoute.GET()).status, 401);
    assert.equal((await collectionsRoute.POST(req("/api/collections", "POST", { title: "x" }))).status, 401);
    assert.equal((await collectionRoute.PATCH(req("/api/collections/x", "PATCH", { title: "x" }), ctx(bobCollectionId))).status, 401);
    assert.equal((await collectionRoute.DELETE(req("/api/collections/x", "DELETE"), ctx(bobCollectionId))).status, 401);
    assert.equal((await ideaCollectionsRoute.PUT(req("/api/save/idea/collections", "PUT", { activityId: aliceActivity, collectionIds: [] }))).status, 401);
    assert.equal((await ideaCollectionsRoute.GET(req(`/api/save/idea/collections?activityId=${aliceActivity}`, "GET"))).status, 401);
    assert.equal(await prisma.collection.count({ where: { userId: bob.id } }), 1, "unauthenticated calls must not write");

    // --- Alice vs Bob's data
    sessionToken = alice.token;
    const aliceCreate = await collectionsRoute.POST(req("/api/collections", "POST", { title: "Alice" }));
    assert.equal(aliceCreate.status, 201);
    const aliceCollectionId = (await aliceCreate.json()).collection.id as string;

    // PUT with a foreign collection -> 404, nothing written
    const putForeignCollection = await ideaCollectionsRoute.PUT(
      req("/api/save/idea/collections", "PUT", { activityId: aliceActivity, collectionIds: [bobCollectionId] }),
    );
    assert.equal(putForeignCollection.status, 404);
    assert.deepEqual(await putForeignCollection.json(), { error: "COLLECTION_NOT_FOUND" });
    // PUT for a foreign idea -> 404
    const putForeignIdea = await ideaCollectionsRoute.PUT(
      req("/api/save/idea/collections", "PUT", { activityId: bobActivity, collectionIds: [aliceCollectionId] }),
    );
    assert.equal(putForeignIdea.status, 404);
    assert.deepEqual(await putForeignIdea.json(), { error: "IDEA_NOT_FOUND" });
    // rename / delete a foreign collection -> 404 and it is untouched
    assert.equal((await collectionRoute.PATCH(req("/api/collections/x", "PATCH", { title: "Hacked" }), ctx(bobCollectionId))).status, 404);
    assert.equal((await collectionRoute.DELETE(req("/api/collections/x", "DELETE"), ctx(bobCollectionId))).status, 404);
    assert.equal((await prisma.collection.findUnique({ where: { id: bobCollectionId } }))?.title, "Bob only");
    // POST /api/save/idea with a foreign collection -> 404 BEFORE the idea is written
    const fresh = `act-fresh-${marker}`;
    const saveForeign = await saveIdeaRoute.POST(req("/api/save/idea", "POST", { activityId: fresh, collectionIds: [bobCollectionId] }));
    assert.equal(saveForeign.status, 404);
    assert.equal(await prisma.idea.count({ where: { userId: alice.id, activityId: fresh } }), 0);
    // GET lists only own collections
    const listed = await (await collectionsRoute.GET()).json();
    assert.deepEqual(listed.collections.map((c: { id: string }) => c.id), [aliceCollectionId]);

    // --- happy path + status codes
    const putOk = await ideaCollectionsRoute.PUT(
      req("/api/save/idea/collections", "PUT", { activityId: aliceActivity, collectionIds: [aliceCollectionId] }),
    );
    assert.equal(putOk.status, 200);
    assert.deepEqual((await putOk.json()).collectionIds, [aliceCollectionId]);
    const saveOk = await saveIdeaRoute.POST(req("/api/save/idea", "POST", { activityId: fresh, collectionIds: [aliceCollectionId] }));
    assert.equal(saveOk.status, 200);
    assert.equal((await collectionsRoute.POST(req("/api/collections", "POST", { title: "alice" }))).status, 409);
    assert.equal((await collectionsRoute.POST(req("/api/collections", "POST", { title: "  " }))).status, 400);
    const afterList = await (await collectionsRoute.GET()).json();
    assert.equal(afterList.collections[0].count, 2);

    console.log("collections.routes.integration.test: ok");
  } finally {
    await prisma.rateLimitEntry.deleteMany({ where: { key: { in: userIds.map((id) => `collection_create:${id}`) } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
