import assert from "node:assert/strict";
import test from "node:test";

import { canonicalJsonString } from "../user-ownership/canonicalJson";
import type { ArticleAuthorshipLineageRow, ArticleAuthorshipReadOnlyRepository, ResolvedArticle, UserLineageInfo } from "./articleAuthorshipReadOnlyRepository";
import { buildArticleAuthorshipProof } from "./classifyArticleAuthorship";
import { determineSlice17Decision } from "./determineSlice17Decision";
import { selectGoldenArticleCandidate } from "./selectGoldenArticleCandidate";
import type { Slice17ArticleCandidate } from "./loadUser575Articles";

/** Minimal in-memory double for the narrow read-only interface — no DB, no fixtures. */
class FakeRepository implements ArticleAuthorshipReadOnlyRepository {
  constructor(
    private readonly userLineage: UserLineageInfo,
    private readonly lineageRows: Map<string, readonly ArticleAuthorshipLineageRow[]>,
    private readonly articles: Map<string, ResolvedArticle>,
    private readonly migrationRecordStatuses: Map<string, readonly string[]>,
  ) {}
  async findUserLineage(): Promise<UserLineageInfo> {
    return this.userLineage;
  }
  async findLineageRowsForSourceKey(sourceRecordKey: string): Promise<readonly ArticleAuthorshipLineageRow[]> {
    return this.lineageRows.get(sourceRecordKey) ?? [];
  }
  async findArticleById(id: string): Promise<ResolvedArticle | null> {
    return this.articles.get(id) ?? null;
  }
  async findMigrationRecordStatuses(sourceRecordKey: string): Promise<readonly string[]> {
    return this.migrationRecordStatuses.get(sourceRecordKey) ?? [];
  }
}

const authorKey = "wordpress-db:user:575";
const candidates: readonly Slice17ArticleCandidate[] = [
  { sourceRecordKey: "wordpress-db:post:56250", legacyPostId: 56250, postStatus: "publish" },
  { sourceRecordKey: "wordpress-db:post:57731", legacyPostId: 57731, postStatus: "publish" },
];

test("both candidates not-yet-migrated: proof reports ARTICLE_TARGET_NOT_MIGRATED and selects the lower post ID as golden", async () => {
  const repository = new FakeRepository({ targetUserId: "user-1", userExists: true, userDeleted: false }, new Map(), new Map(), new Map());
  const entries = await buildArticleAuthorshipProof(repository, authorKey, candidates);
  assert.equal(entries.length, 2);
  assert.ok(entries.every(entry => entry.classification === "ARTICLE_TARGET_NOT_MIGRATED"));
  assert.equal(determineSlice17Decision(entries), "ARTICLE_GOLDEN_REQUIRED");
  assert.equal(selectGoldenArticleCandidate(entries)?.sourceRecordKey, "wordpress-db:post:56250");
});

test("one exact candidate, one already satisfied: decision is AUTHORSHIP_GOLDEN_READY (more actionable than not-migrated)", async () => {
  const lineageRows = new Map<string, readonly ArticleAuthorshipLineageRow[]>([
    ["wordpress-db:post:56250", [{ targetType: "ARTICLE", targetId: "article-a", isActive: true }]],
    ["wordpress-db:post:57731", [{ targetType: "ARTICLE", targetId: "article-b", isActive: true }]],
  ]);
  const articles = new Map<string, ResolvedArticle>([
    ["article-a", { id: "article-a", authorUserId: null }],
    ["article-b", { id: "article-b", authorUserId: "user-1" }],
  ]);
  const repository = new FakeRepository({ targetUserId: "user-1", userExists: true, userDeleted: false }, lineageRows, articles, new Map());
  const entries = await buildArticleAuthorshipProof(repository, authorKey, candidates);
  const byKey = new Map(entries.map(entry => [entry.sourceRecordKey, entry]));
  assert.equal(byKey.get("wordpress-db:post:56250")?.classification, "EXACT_AUTHORSHIP_CANDIDATE");
  assert.equal(byKey.get("wordpress-db:post:57731")?.classification, "ALREADY_SATISFIED");
  assert.equal(determineSlice17Decision(entries), "AUTHORSHIP_GOLDEN_READY");
});

test("both already satisfied: decision is AUTHORSHIP_ALREADY_SATISFIED", async () => {
  const lineageRows = new Map<string, readonly ArticleAuthorshipLineageRow[]>([
    ["wordpress-db:post:56250", [{ targetType: "ARTICLE", targetId: "article-a", isActive: true }]],
    ["wordpress-db:post:57731", [{ targetType: "ARTICLE", targetId: "article-b", isActive: true }]],
  ]);
  const articles = new Map<string, ResolvedArticle>([
    ["article-a", { id: "article-a", authorUserId: "user-1" }],
    ["article-b", { id: "article-b", authorUserId: "user-1" }],
  ]);
  const repository = new FakeRepository({ targetUserId: "user-1", userExists: true, userDeleted: false }, lineageRows, articles, new Map());
  const entries = await buildArticleAuthorshipProof(repository, authorKey, candidates);
  assert.ok(entries.every(entry => entry.classification === "ALREADY_SATISFIED"));
  assert.equal(determineSlice17Decision(entries), "AUTHORSHIP_ALREADY_SATISFIED");
});

test("a conflict on either candidate makes the overall decision BLOCKED", async () => {
  const lineageRows = new Map<string, readonly ArticleAuthorshipLineageRow[]>([["wordpress-db:post:56250", [{ targetType: "ARTICLE", targetId: "article-a", isActive: true }, { targetType: "ARTICLE", targetId: "article-a2", isActive: true }]]]);
  const repository = new FakeRepository({ targetUserId: "user-1", userExists: true, userDeleted: false }, lineageRows, new Map(), new Map());
  const entries = await buildArticleAuthorshipProof(repository, authorKey, candidates);
  assert.equal(determineSlice17Decision(entries), "BLOCKED");
});

test("missing User lineage blocks every candidate", async () => {
  const repository = new FakeRepository({ targetUserId: null, userExists: false, userDeleted: false }, new Map(), new Map(), new Map());
  const entries = await buildArticleAuthorshipProof(repository, authorKey, candidates);
  assert.ok(entries.every(entry => entry.classification === "BLOCKED" && entry.reasonCode === "USER_LINEAGE_MISSING"));
  assert.equal(determineSlice17Decision(entries), "BLOCKED");
});

test("running the proof twice against the same evidence yields identical entries and hashes", async () => {
  const repository = new FakeRepository({ targetUserId: "user-1", userExists: true, userDeleted: false }, new Map(), new Map(), new Map());
  const first = await buildArticleAuthorshipProof(repository, authorKey, candidates);
  const second = await buildArticleAuthorshipProof(repository, authorKey, candidates);
  assert.equal(canonicalJsonString(first), canonicalJsonString(second));
  assert.deepEqual(
    first.map(entry => entry.evidenceHash),
    second.map(entry => entry.evidenceHash),
  );
});

test("results are sorted deterministically by sourceRecordKey regardless of input order", async () => {
  const repository = new FakeRepository({ targetUserId: "user-1", userExists: true, userDeleted: false }, new Map(), new Map(), new Map());
  const reversed = [...candidates].reverse();
  const entries = await buildArticleAuthorshipProof(repository, authorKey, reversed);
  assert.deepEqual(
    entries.map(entry => entry.sourceRecordKey),
    ["wordpress-db:post:56250", "wordpress-db:post:57731"],
  );
});

test("manifest entries contain no email, phone, password, or raw WordPress metadata", async () => {
  const repository = new FakeRepository({ targetUserId: "user-1", userExists: true, userDeleted: false }, new Map(), new Map(), new Map());
  const entries = await buildArticleAuthorshipProof(repository, authorKey, candidates);
  const serialized = JSON.stringify(entries);
  assert.equal(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(serialized), false, "must not contain an email address");
  for (const forbidden of ["passwordHash", "password", "legacyLogin", "displayName", "phoneE164", "title", "content", "media"]) {
    assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false, `must not contain "${forbidden}"`);
  }
});
