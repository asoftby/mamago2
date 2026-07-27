import assert from "node:assert/strict";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { canonicalHash } from "../user-ownership/canonicalJson";
import { createReadOnlyPrismaClient, createUserOwnershipReadOnlyRepository } from "../user-ownership/readOnlyRepository";
import { createArticleAuthorshipReadOnlyRepository } from "./articleAuthorshipReadOnlyRepository";
import { buildArticleAuthorshipProof } from "./classifyArticleAuthorship";
import { determineSlice17Decision } from "./determineSlice17Decision";
import type { Slice17ArticleCandidate } from "./loadUser575Articles";

/**
 * Self-contained: a dedicated test namespace and entirely synthetic
 * WordPress IDs (95xxxx — never real production data), mirroring
 * BusinessOwnershipGoldenRunner.integration.test.ts's fixture convention.
 * Exercises the real read-only Prisma extension guard end-to-end, never
 * touching `/tmp` or the durable home-directory Activity snapshot.
 */
const prisma = new PrismaClient();
const readOnlyClient = createReadOnlyPrismaClient(prisma);
const baselineRepository = createUserOwnershipReadOnlyRepository(readOnlyClient);
const repository = createArticleAuthorshipReadOnlyRepository(readOnlyClient);

const namespace = `article-authorship-proof-test-${process.pid}`;
const legacyUserId = 950001;
const userSourceRecordKey = `wordpress-db:user:${legacyUserId}`;
const email = `article-authorship-proof-${process.pid}@example.test`;

const notMigratedKey = "wordpress-db:post:950001";
const exactCandidateKey = "wordpress-db:post:950002";
const alreadySatisfiedKey = "wordpress-db:post:950003";

const candidates: readonly Slice17ArticleCandidate[] = [
  { sourceRecordKey: notMigratedKey, legacyPostId: 950001, postStatus: "publish" },
  { sourceRecordKey: exactCandidateKey, legacyPostId: 950002, postStatus: "publish" },
  { sourceRecordKey: alreadySatisfiedKey, legacyPostId: 950003, postStatus: "publish" },
];

async function cleanup(): Promise<void> {
  const source = await prisma.migrationSource.findUnique({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: namespace } } });
  if (source) await prisma.migrationSource.delete({ where: { id: source.id } });
  await prisma.article.deleteMany({ where: { title: { startsWith: "Article Authorship Proof Test" } } });
  await prisma.user.deleteMany({ where: { email } });
}

async function seedFixture(): Promise<void> {
  const user = await prisma.user.create({ data: { email, role: "USER", status: "PENDING_ACTIVATION", displayName: "Article Authorship Proof Test User" } });
  const exactArticle = await prisma.article.create({ data: { title: "Article Authorship Proof Test Article Exact", authorUserId: null } });
  const satisfiedArticle = await prisma.article.create({ data: { title: "Article Authorship Proof Test Article Satisfied", authorUserId: user.id } });

  const source = await prisma.migrationSource.upsert({
    where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: namespace } },
    create: { adapterKey: "wordpress-db", sourceNamespace: namespace, name: "test fixture" },
    update: {},
  });

  await prisma.migrationLineage.create({
    data: {
      sourceId: source.id,
      sourceEntityType: "wordpress-db:user",
      sourceStableKey: userSourceRecordKey,
      sourceRecordKey: userSourceRecordKey,
      targetType: "USER",
      targetId: user.id,
      targetRole: "primary",
      lastSourceHash: "fixture",
      isActive: true,
    },
  });
  await prisma.migrationLineage.create({
    data: {
      sourceId: source.id,
      sourceEntityType: "wordpress-db:post",
      sourceStableKey: exactCandidateKey,
      sourceRecordKey: exactCandidateKey,
      targetType: "ARTICLE",
      targetId: exactArticle.id,
      targetRole: "primary",
      lastSourceHash: "fixture",
      isActive: true,
    },
  });
  await prisma.migrationLineage.create({
    data: {
      sourceId: source.id,
      sourceEntityType: "wordpress-db:post",
      sourceStableKey: alreadySatisfiedKey,
      sourceRecordKey: alreadySatisfiedKey,
      targetType: "ARTICLE",
      targetId: satisfiedArticle.id,
      targetRole: "primary",
      lastSourceHash: "fixture",
      isActive: true,
    },
  });
}

test.before(async () => {
  await cleanup();
  await seedFixture();
});

test.after(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("classifies a real not-migrated, exact-candidate, and already-satisfied mix correctly through the real repository", async () => {
  const entries = await buildArticleAuthorshipProof(repository, userSourceRecordKey, candidates);
  const byKey = new Map(entries.map(entry => [entry.sourceRecordKey, entry]));
  assert.equal(byKey.get(notMigratedKey)?.classification, "ARTICLE_TARGET_NOT_MIGRATED");
  assert.equal(byKey.get(exactCandidateKey)?.classification, "EXACT_AUTHORSHIP_CANDIDATE");
  assert.equal(byKey.get(alreadySatisfiedKey)?.classification, "ALREADY_SATISFIED");
  assert.equal(determineSlice17Decision(entries), "AUTHORSHIP_GOLDEN_READY");
});

test("running twice against the same DB state yields identical evidence hashes", async () => {
  const first = await buildArticleAuthorshipProof(repository, userSourceRecordKey, candidates);
  const second = await buildArticleAuthorshipProof(repository, userSourceRecordKey, candidates);
  assert.deepEqual(
    first.map(entry => entry.evidenceHash),
    second.map(entry => entry.evidenceHash),
  );
});

test("performs zero database writes: before/after counts and a role/status distribution hash are identical", async () => {
  const before = await baselineRepository.captureBaselineCounts();
  const beforeRoles = canonicalHash(await baselineRepository.roleStatusDistribution());

  await buildArticleAuthorshipProof(repository, userSourceRecordKey, candidates);

  const after = await baselineRepository.captureBaselineCounts();
  const afterRoles = canonicalHash(await baselineRepository.roleStatusDistribution());

  assert.deepEqual(before, after);
  assert.equal(beforeRoles, afterRoles);
});
