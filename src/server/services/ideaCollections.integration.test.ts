import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  COLLECTIONS_PER_USER_LIMIT,
  IdeaCollectionError,
  addIdeaToCollections,
  createCollection,
  deleteCollection,
  getIdeaCollectionIds,
  listCollections,
  renameCollection,
  setIdeaCollections,
} from "./ideaCollections.service";

const marker = randomUUID();
const userIds: string[] = [];

async function createUser(label: string) {
  const user = await prisma.user.create({
    data: { email: `idea-collections-${label}-${marker}@example.invalid` },
    select: { id: true },
  });
  userIds.push(user.id);
  return user.id;
}

const activity = (label: string) => ({ kind: "ACTIVITY" as const, id: `act-${label}-${marker}` });

async function saveIdea(userId: string, target: { id: string }) {
  return prisma.idea.create({ data: { userId, activityId: target.id }, select: { id: true } });
}

function expectCode(code: string) {
  return (error: unknown) => error instanceof IdeaCollectionError && error.code === code;
}

async function main() {
  try {
    const alice = await createUser("alice");
    const bob = await createUser("bob");

    const aliceIdea = activity("alice");
    const bobIdea = activity("bob");
    await saveIdea(alice, aliceIdea);
    await saveIdea(bob, bobIdea);
    const aliceCol = await createCollection(alice, "Новый год");
    const bobCol = await createCollection(bob, "Bob only");

    // --- access: foreign collection -> 404, and nothing is written
    await assert.rejects(setIdeaCollections(alice, aliceIdea, [bobCol.id]), expectCode("COLLECTION_NOT_FOUND"));
    await assert.rejects(addIdeaToCollections(alice, aliceIdea, [aliceCol.id, bobCol.id]), expectCode("COLLECTION_NOT_FOUND"));
    assert.equal(await prisma.collectionItem.count({ where: { collectionId: { in: [aliceCol.id, bobCol.id] } } }), 0);
    await assert.rejects(setIdeaCollections(alice, aliceIdea, ["does-not-exist"]), expectCode("COLLECTION_NOT_FOUND"));

    // --- access: foreign idea -> 404 (Alice never saved Bob's idea)
    await assert.rejects(setIdeaCollections(alice, bobIdea, [aliceCol.id]), expectCode("IDEA_NOT_FOUND"));
    await assert.rejects(addIdeaToCollections(alice, bobIdea, [aliceCol.id]), expectCode("IDEA_NOT_FOUND"));
    assert.equal(await prisma.collectionItem.count({ where: { collectionId: aliceCol.id } }), 0);
    // a foreign idea reveals nothing through the read helper either
    assert.deepEqual(await getIdeaCollectionIds(alice, bobIdea), []);

    // --- access: foreign collection can't be renamed / deleted / listed
    await assert.rejects(renameCollection(alice, bobCol.id, "Hacked"), expectCode("COLLECTION_NOT_FOUND"));
    await assert.rejects(deleteCollection(alice, bobCol.id), expectCode("COLLECTION_NOT_FOUND"));
    assert.equal((await prisma.collection.findUnique({ where: { id: bobCol.id } }))?.title, "Bob only");
    assert.deepEqual((await listCollections(alice)).map((c) => c.id), [aliceCol.id]);

    // --- set semantics: full set, idempotent, move
    const second = await createCollection(alice, "На выходные");
    assert.deepEqual(await setIdeaCollections(alice, aliceIdea, [aliceCol.id, aliceCol.id]), [aliceCol.id]);
    await setIdeaCollections(alice, aliceIdea, [aliceCol.id]); // repeat -> no duplicate
    assert.equal(await prisma.collectionItem.count({ where: { collectionId: aliceCol.id } }), 1);
    await setIdeaCollections(alice, aliceIdea, [second.id]); // move
    assert.deepEqual(await getIdeaCollectionIds(alice, aliceIdea), [second.id]);
    await setIdeaCollections(alice, aliceIdea, [aliceCol.id, second.id]); // several collections
    assert.equal((await getIdeaCollectionIds(alice, aliceIdea)).length, 2);
    await setIdeaCollections(alice, aliceIdea, []); // back to «Без коллекции»
    assert.deepEqual(await getIdeaCollectionIds(alice, aliceIdea), []);
    await addIdeaToCollections(alice, aliceIdea, [aliceCol.id]);
    await addIdeaToCollections(alice, aliceIdea, [aliceCol.id]);
    assert.equal(await prisma.collectionItem.count({ where: { collectionId: aliceCol.id } }), 1);

    // --- list: count aggregate, own data only
    const listed = await listCollections(alice);
    assert.equal(listed.find((c) => c.id === aliceCol.id)?.count, 1);
    assert.equal(listed.find((c) => c.id === second.id)?.count, 0);

    // --- duplicates -> 409 (case-insensitive), other users unaffected
    await assert.rejects(createCollection(alice, "новый год"), expectCode("COLLECTION_EXISTS"));
    await assert.rejects(createCollection(alice, "  НОВЫЙ   ГОД "), expectCode("COLLECTION_EXISTS"));
    await assert.rejects(renameCollection(alice, second.id, "новый год"), expectCode("COLLECTION_EXISTS"));
    assert.equal((await renameCollection(alice, aliceCol.id, "НОВЫЙ ГОД")).title, "НОВЫЙ ГОД"); // own title, new case
    assert.equal((await createCollection(bob, "новый год")).title, "новый год");
    await assert.rejects(createCollection(alice, "   "), expectCode("INVALID_TITLE"));

    // --- create with activityId saves the idea and files it
    const fresh = activity("fresh");
    const withIdea = await createCollection(alice, "Сразу с идеей", { activityId: fresh.id });
    assert.deepEqual(await getIdeaCollectionIds(alice, fresh), [withIdea.id]);
    assert.equal(await prisma.idea.count({ where: { userId: alice, activityId: fresh.id } }), 1);

    // --- polymorphic: offer idea (needs a real Offer row)
    const offer = await prisma.offer.findFirst({ select: { id: true } });
    if (offer) {
      await prisma.offerIdea.create({ data: { userId: alice, offerId: offer.id } });
      await setIdeaCollections(alice, { kind: "OFFER", id: offer.id }, [aliceCol.id]);
      assert.deepEqual(await getIdeaCollectionIds(alice, { kind: "OFFER", id: offer.id }), [aliceCol.id]);
      await assert.rejects(setIdeaCollections(bob, { kind: "OFFER", id: offer.id }, [bobCol.id]), expectCode("IDEA_NOT_FOUND"));
    } else {
      console.warn("[skip] no Offer row in local DB: polymorphic OFFER case not exercised");
    }

    // --- delete collection keeps the ideas
    await deleteCollection(alice, aliceCol.id);
    assert.equal(await prisma.collectionItem.count({ where: { collectionId: aliceCol.id } }), 0);
    assert.equal(await prisma.idea.count({ where: { userId: alice, activityId: aliceIdea.id } }), 1);

    // --- limit: 50 per user -> 422; deleting one frees a slot
    const carol = await createUser("carol");
    for (let i = 0; i < COLLECTIONS_PER_USER_LIMIT; i += 1) await createCollection(carol, `Коллекция ${i}`);
    await assert.rejects(createCollection(carol, "Лишняя"), expectCode("COLLECTION_LIMIT"));
    await assert.rejects(createCollection(carol, "Ещё одна", { activityId: activity("x").id }), expectCode("COLLECTION_LIMIT"));
    assert.equal(await prisma.idea.count({ where: { userId: carol } }), 0); // rejected create wrote nothing
    const [any] = await listCollections(carol);
    await deleteCollection(carol, any!.id);
    await createCollection(carol, "Теперь можно");

    // --- concurrent creates can't exceed the limit
    const dave = await createUser("dave");
    const results = await Promise.allSettled(
      Array.from({ length: COLLECTIONS_PER_USER_LIMIT + 5 }, (_, i) => createCollection(dave, `P${i}`)),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, COLLECTIONS_PER_USER_LIMIT);
    assert.equal(await prisma.collection.count({ where: { userId: dave } }), COLLECTIONS_PER_USER_LIMIT);

    console.log("ideaCollections.integration.test: ok");
  } finally {
    // Cascade removes collections, ideas and items.
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
