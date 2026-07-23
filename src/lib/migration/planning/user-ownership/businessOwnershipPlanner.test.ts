import assert from "node:assert/strict";
import test from "node:test";

import { planBusinessOwnership } from "./businessOwnershipPlanner";
import type { BaselineCounts, PlaceOwnershipRow, UserOwnershipReadOnlyRepository } from "./readOnlyRepository";
import type { BusinessOwnershipSourceEvidence } from "./snapshotEvidence";

/** Minimal in-memory double for the narrow read-only interface — no DB, no fixtures. */
class FakeRepository implements UserOwnershipReadOnlyRepository {
  constructor(
    private readonly userLineage: Map<string, string>,
    private readonly placeLineage: Map<string, string>,
    private readonly placeOwnership: Map<string, PlaceOwnershipRow>,
    private readonly businessOwners: Map<string, string>,
  ) {}
  async captureBaselineCounts(): Promise<BaselineCounts> {
    throw new Error("not used in this test");
  }
  async roleStatusDistribution(): Promise<never> {
    throw new Error("not used in this test");
  }
  async findLineageTargetIds(targetType: string, keys: readonly string[]) {
    const source = targetType === "USER" ? this.userLineage : this.placeLineage;
    return new Map([...source].filter(([key]) => keys.includes(key)));
  }
  async findPlaceOwnership(ids: readonly string[]) {
    return new Map([...this.placeOwnership].filter(([id]) => ids.includes(id)));
  }
  async findBusinessOwners(ids: readonly string[]) {
    return new Map([...this.businessOwners].filter(([id]) => ids.includes(id)));
  }
  async findArticleAuthors(): Promise<ReadonlyMap<string, string | null>> {
    throw new Error("not used in this test");
  }
  async findRouteAuthors(): Promise<ReadonlyMap<string, string | null>> {
    throw new Error("not used in this test");
  }
  async findActivityOwners(): Promise<ReadonlyMap<string, string>> {
    throw new Error("not used in this test");
  }
}

function evidence(sourceRecordKey: string, placePostIds: readonly string[]): BusinessOwnershipSourceEvidence {
  return { sourceRecordKey, placePostIds };
}

test("exact lineage with no existing Business owner is an exact link candidate", async () => {
  const repo = new FakeRepository(
    new Map([["wordpress-db:user:38", "user-38"]]),
    new Map([["wordpress-db:places:9870", "place-9870"]]),
    new Map([["place-9870", { ownerBusinessId: null, createdByUserId: "fallback-admin" }]]),
    new Map(),
  );
  const [entry] = await planBusinessOwnership([evidence("wordpress-db:user:38", ["9870"])], repo);
  assert.equal(entry.action, "EXACT_LINK_CANDIDATE");
  assert.equal(entry.roleRecommendation, "ELIGIBLE_FOR_BUSINESS_OWNER_AFTER_OWNERSHIP_WRITE");
});

test("place lineage missing entirely is TARGET_ENTITY_NOT_MIGRATED", async () => {
  const repo = new FakeRepository(new Map([["wordpress-db:user:40", "user-40"]]), new Map(), new Map(), new Map());
  const [entry] = await planBusinessOwnership([evidence("wordpress-db:user:40", ["1"])], repo);
  assert.equal(entry.action, "TARGET_ENTITY_NOT_MIGRATED");
});

test("Place already owned by a Business belonging to a different user is a current-owner conflict", async () => {
  const repo = new FakeRepository(
    new Map([["wordpress-db:user:41", "user-41"]]),
    new Map([["wordpress-db:places:1", "place-1"]]),
    new Map([["place-1", { ownerBusinessId: "biz-1", createdByUserId: "fallback" }]]),
    new Map([["biz-1", "some-other-user"]]),
  );
  const [entry] = await planBusinessOwnership([evidence("wordpress-db:user:41", ["1"])], repo);
  assert.equal(entry.action, "CURRENT_OWNER_CONFLICT");
});

test("Place already owned by a Business belonging to the same user is already satisfied", async () => {
  const repo = new FakeRepository(
    new Map([["wordpress-db:user:42", "user-42"]]),
    new Map([["wordpress-db:places:1", "place-1"]]),
    new Map([["place-1", { ownerBusinessId: "biz-1", createdByUserId: "fallback" }]]),
    new Map([["biz-1", "user-42"]]),
  );
  const [entry] = await planBusinessOwnership([evidence("wordpress-db:user:42", ["1"])], repo);
  assert.equal(entry.action, "ALREADY_SATISFIED");
  assert.equal(entry.roleRecommendation, "KEEP_USER");
});

test("two different source users claiming the same target Place is MULTIPLE_SOURCE_OWNERS", async () => {
  const repo = new FakeRepository(
    new Map([
      ["wordpress-db:user:43", "user-43"],
      ["wordpress-db:user:44", "user-44"],
    ]),
    new Map([
      ["wordpress-db:places:7", "place-7"],
      ["wordpress-db:places:8", "place-7"],
    ]),
    new Map([["place-7", { ownerBusinessId: null, createdByUserId: "fallback" }]]),
    new Map(),
  );
  const [a, b] = await planBusinessOwnership([evidence("wordpress-db:user:43", ["7"]), evidence("wordpress-db:user:44", ["8"])], repo);
  assert.equal(a.action, "MULTIPLE_SOURCE_OWNERS");
  assert.equal(b.action, "MULTIPLE_SOURCE_OWNERS");
});

test("no User lineage at all (identity not resolved) forces manual review, never an exact action", async () => {
  const repo = new FakeRepository(new Map(), new Map([["wordpress-db:places:1", "place-1"]]), new Map([["place-1", { ownerBusinessId: null, createdByUserId: "fallback" }]]), new Map());
  const [entry] = await planBusinessOwnership([evidence("wordpress-db:user:45", ["1"])], repo);
  assert.equal(entry.action, "MANUAL_REVIEW");
  assert.equal(entry.userLineagePresent, false);
});

test("partial place lineage coverage cannot be exact, even with no conflicts", async () => {
  const repo = new FakeRepository(
    new Map([["wordpress-db:user:89", "user-89"]]),
    new Map([["wordpress-db:places:1", "place-1"]]),
    new Map([["place-1", { ownerBusinessId: null, createdByUserId: "fallback" }]]),
    new Map(),
  );
  const [entry] = await planBusinessOwnership([evidence("wordpress-db:user:89", ["1", "2", "3"])], repo);
  assert.equal(entry.action, "MANUAL_REVIEW");
  assert.equal(entry.sourceEntityLineagePresentCount, 1);
  assert.equal(entry.sourceEntityCount, 3);
});

test("role recommendation is reported separately from the ownership action and never auto-elevates", async () => {
  const repo = new FakeRepository(new Map(), new Map(), new Map(), new Map());
  const [entry] = await planBusinessOwnership([evidence("wordpress-db:user:46", [])], repo);
  assert.notEqual(entry.roleRecommendation, "AUTO_ADMIN" as never);
  assert.notEqual(entry.roleRecommendation, "AUTO_MODERATOR" as never);
  assert.ok(["KEEP_USER", "ELIGIBLE_FOR_BUSINESS_OWNER_AFTER_OWNERSHIP_WRITE", "MANUAL_ROLE_REVIEW"].includes(entry.roleRecommendation));
});

test("the repository interface exposes no write methods to call by accident", () => {
  const repo = new FakeRepository(new Map(), new Map(), new Map(), new Map());
  const forbidden = ["create", "update", "upsert", "delete", "deleteMany", "$executeRaw"] as const;
  for (const method of forbidden) {
    assert.equal((repo as unknown as Record<string, unknown>)[method], undefined, `read-only repository must not expose "${method}"`);
  }
});
