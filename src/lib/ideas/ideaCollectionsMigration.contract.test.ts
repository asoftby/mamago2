import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const sql = read("prisma/migrations/20261013150000_idea_collections/migration.sql");
const IDEA_FKS = ["ideaId", "offerIdeaId", "routeIdeaId", "placeIdeaId", "articleIdeaId"] as const;

// Exactly one idea FK per CollectionItem row.
assert.match(
  sql,
  /ADD CONSTRAINT "CollectionItem_exactly_one_idea_chk" CHECK \(\s*num_nonnulls\("ideaId", "offerIdeaId", "routeIdeaId", "placeIdeaId", "articleIdeaId"\) = 1\s*\)/,
);

// One partial unique index per idea type.
for (const fk of IDEA_FKS) {
  assert.ok(
    sql.includes(
      `CREATE UNIQUE INDEX "CollectionItem_collectionId_${fk}_key" ON "CollectionItem"("collectionId", "${fk}") WHERE "${fk}" IS NOT NULL;`,
    ),
    `missing partial unique index for ${fk}`,
  );
}

// Case-insensitive title uniqueness per user.
assert.ok(
  sql.includes(
    'CREATE UNIQUE INDEX "Collection_userId_lower_title_key" ON "Collection"("userId", lower("title"));',
  ),
);

// Every FK cascades: user -> collection, collection -> item, each idea type -> item.
const fkNames = [
  "Collection_userId_fkey",
  "CollectionItem_collectionId_fkey",
  ...IDEA_FKS.map((fk) => `CollectionItem_${fk}_fkey`),
];
assert.equal(fkNames.length, 7);
for (const name of fkNames) {
  assert.match(sql, new RegExp(`ADD CONSTRAINT "${name}" FOREIGN KEY .* ON DELETE CASCADE`), name);
}

// No data move: Idea stays as is.
assert.doesNotMatch(sql, /INSERT\s+INTO|UPDATE\s+"|DROP\s+/i);

// schema.prisma keeps the polymorphic model in sync.
const schema = read("prisma/schema.prisma");
const item = schema.match(/model CollectionItem \{[\s\S]*?\n\}/)?.[0] ?? "";
for (const fk of IDEA_FKS) assert.match(item, new RegExp(`\\n\\s+${fk}\\s+String\\?\\s`), fk);
assert.match(schema.match(/model Collection \{[\s\S]*?\n\}/)?.[0] ?? "", /title\s+String\s+@db\.VarChar\(60\)/);

console.log("ideaCollectionsMigration.contract.test: ok");
