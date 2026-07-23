import assert from "node:assert/strict";
import test from "node:test";

import { planContentAuthorship } from "./contentAuthorshipPlanner";
import type { BaselineCounts, PlaceOwnershipRow, UserOwnershipReadOnlyRepository } from "./readOnlyRepository";
import type { AuthoredContentItem, ContentAuthorshipSourceEvidence } from "./snapshotEvidence";

class FakeRepository implements UserOwnershipReadOnlyRepository {
  constructor(
    private readonly userLineage: Map<string, string>,
    private readonly contentLineage: { ARTICLE: Map<string, string>; ROUTE: Map<string, string>; ACTIVITY: Map<string, string> },
    private readonly articleAuthors: Map<string, string | null>,
    private readonly routeAuthors: Map<string, string | null>,
    private readonly activityOwners: Map<string, string>,
  ) {}
  async captureBaselineCounts(): Promise<BaselineCounts> {
    throw new Error("not used");
  }
  async roleStatusDistribution(): Promise<never> {
    throw new Error("not used");
  }
  async findLineageTargetIds(targetType: string, keys: readonly string[]) {
    const source = targetType === "USER" ? this.userLineage : this.contentLineage[targetType as "ARTICLE" | "ROUTE" | "ACTIVITY"];
    return new Map([...source].filter(([key]) => keys.includes(key)));
  }
  async findPlaceOwnership(): Promise<ReadonlyMap<string, PlaceOwnershipRow>> {
    throw new Error("not used");
  }
  async findBusinessOwners(): Promise<ReadonlyMap<string, string>> {
    throw new Error("not used");
  }
  async findArticleAuthors(ids: readonly string[]) {
    return new Map([...this.articleAuthors].filter(([id]) => ids.includes(id)));
  }
  async findRouteAuthors(ids: readonly string[]) {
    return new Map([...this.routeAuthors].filter(([id]) => ids.includes(id)));
  }
  async findActivityOwners(ids: readonly string[]) {
    return new Map([...this.activityOwners].filter(([id]) => ids.includes(id)));
  }
}

function evidence(sourceRecordKey: string, items: readonly AuthoredContentItem[]): ContentAuthorshipSourceEvidence {
  return { sourceRecordKey, authoredItems: items };
}
function article(postId: string) {
  return { postId, postType: "post", contentType: "ARTICLE" as const };
}
function route(postId: string) {
  return { postId, postType: "routes", contentType: "ROUTE" as const };
}
function activity(postId: string) {
  return { postId, postType: "events", contentType: "ACTIVITY" as const };
}
function unsupported(postId: string) {
  return { postId, postType: "specialists", contentType: "UNSUPPORTED" as const };
}

test("exact lineage with an unset current author is an exact author-link candidate", async () => {
  const repo = new FakeRepository(
    new Map([["wordpress-db:user:91", "user-91"]]),
    { ARTICLE: new Map([["wordpress-db:post:1", "article-1"]]), ROUTE: new Map(), ACTIVITY: new Map() },
    new Map([["article-1", null]]),
    new Map(),
    new Map(),
  );
  const [entry] = await planContentAuthorship([evidence("wordpress-db:user:91", [article("1")])], repo);
  assert.equal(entry.action, "EXACT_AUTHOR_LINK_CANDIDATE");
});

test("no content lineage at all is TARGET_CONTENT_NOT_MIGRATED", async () => {
  const repo = new FakeRepository(new Map([["wordpress-db:user:42", "user-42"]]), { ARTICLE: new Map(), ROUTE: new Map(), ACTIVITY: new Map() }, new Map(), new Map(), new Map());
  const [entry] = await planContentAuthorship([evidence("wordpress-db:user:42", [activity("1")])], repo);
  assert.equal(entry.action, "TARGET_CONTENT_NOT_MIGRATED");
});

test("Activity already owned by a different user is a current-author conflict (ownerUserId is required, never null)", async () => {
  const repo = new FakeRepository(
    new Map([["wordpress-db:user:521", "user-521"]]),
    { ARTICLE: new Map(), ROUTE: new Map(), ACTIVITY: new Map([["wordpress-db:events:1", "activity-1"]]) },
    new Map(),
    new Map(),
    new Map([["activity-1", "fallback-admin"]]),
  );
  const [entry] = await planContentAuthorship([evidence("wordpress-db:user:521", [activity("1")])], repo);
  assert.equal(entry.action, "CURRENT_AUTHOR_CONFLICT");
});

test("two source users both claiming the same migrated Article is MULTIPLE_SOURCE_AUTHORS", async () => {
  const repo = new FakeRepository(
    new Map([
      ["wordpress-db:user:1", "user-1"],
      ["wordpress-db:user:2", "user-2"],
    ]),
    { ARTICLE: new Map([["wordpress-db:post:5", "article-5"], ["wordpress-db:post:6", "article-5"]]), ROUTE: new Map(), ACTIVITY: new Map() },
    new Map([["article-5", null]]),
    new Map(),
    new Map(),
  );
  const [a, b] = await planContentAuthorship([evidence("wordpress-db:user:1", [article("5")]), evidence("wordpress-db:user:2", [article("6")])], repo);
  assert.equal(a.action, "MULTIPLE_SOURCE_AUTHORS");
  assert.equal(b.action, "MULTIPLE_SOURCE_AUTHORS");
});

test("Route authorship (a user with mixed authored Article and Route content) is reconciled through Route lineage too", async () => {
  const repo = new FakeRepository(
    new Map([["wordpress-db:user:91", "user-91"]]),
    { ARTICLE: new Map(), ROUTE: new Map([["wordpress-db:routes:9", "route-9"]]), ACTIVITY: new Map() },
    new Map(),
    new Map([["route-9", null]]),
    new Map(),
  );
  const [entry] = await planContentAuthorship([evidence("wordpress-db:user:91", [route("9")])], repo);
  assert.equal(entry.action, "EXACT_AUTHOR_LINK_CANDIDATE");
  assert.ok(entry.authoredContentTypes.includes("ROUTE"));
});

test("authored content of an unsupported WordPress post type never gets an exact action", async () => {
  const repo = new FakeRepository(new Map([["wordpress-db:user:7", "user-7"]]), { ARTICLE: new Map(), ROUTE: new Map(), ACTIVITY: new Map() }, new Map(), new Map(), new Map());
  const [entry] = await planContentAuthorship([evidence("wordpress-db:user:7", [unsupported("1")])], repo);
  assert.equal(entry.action, "UNSUPPORTED_CONTENT_TYPE");
});

test("an already-correct author is ALREADY_SATISFIED, not re-linked", async () => {
  const repo = new FakeRepository(
    new Map([["wordpress-db:user:575", "user-575"]]),
    { ARTICLE: new Map([["wordpress-db:post:2", "article-2"]]), ROUTE: new Map(), ACTIVITY: new Map() },
    new Map([["article-2", "user-575"]]),
    new Map(),
    new Map(),
  );
  const [entry] = await planContentAuthorship([evidence("wordpress-db:user:575", [article("2")])], repo);
  assert.equal(entry.action, "ALREADY_SATISFIED");
});

test("planner never calls a write method — the repository double only exposes reads", () => {
  const repo = new FakeRepository(new Map(), { ARTICLE: new Map(), ROUTE: new Map(), ACTIVITY: new Map() }, new Map(), new Map(), new Map());
  for (const method of ["create", "update", "upsert", "delete", "deleteMany"] as const) {
    assert.equal((repo as unknown as Record<string, unknown>)[method], undefined);
  }
});
