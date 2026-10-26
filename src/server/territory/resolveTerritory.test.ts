/**
 * Run: pnpm exec tsx src/server/territory/resolveTerritory.test.ts
 */
import assert from "node:assert/strict";
import type { TerritoryType } from "@prisma/client";
import { pickTerritoryByPrecedence, resolveTerritoryBySlug, resolveTerritoryFromPathname } from "./resolveTerritory";

const row = (type: TerritoryType, slug: string) => ({
  id: `${type}_${slug}`, type, slug, name: slug, nameIn: null, parentId: null, isActive: true, isIndexable: true,
});

async function main() {
  // Region and city share the slug `minsk`: URL /minsk/ must give the REGION.
  assert.equal(pickTerritoryByPrecedence([row("CITY", "minsk"), row("REGION", "minsk")])!.type, "REGION");
  assert.equal(pickTerritoryByPrecedence([row("CITY", "x"), row("COUNTRY", "x")])!.type, "COUNTRY");
  assert.equal(pickTerritoryByPrecedence([row("CITY", "kopishche")])!.type, "CITY");
  assert.equal(pickTerritoryByPrecedence([]), null);

  const calls: unknown[] = [];
  const db = {
    territory: {
      findMany: async (args: { where: { slug: string } }) => {
        calls.push(args);
        const all = [row("COUNTRY", "belarus"), row("REGION", "minsk"), row("CITY", "minsk"), row("CITY", "kopishche")];
        return all.filter((r) => r.slug === args.where.slug);
      },
    },
  } as never;

  assert.equal((await resolveTerritoryBySlug("belarus", { db }))!.type, "COUNTRY");
  assert.equal((await resolveTerritoryBySlug("MINSK", { db }))!.type, "REGION");
  assert.equal((await resolveTerritoryFromPathname("/belarus/blog", { db }))!.type, "COUNTRY");
  assert.equal((await resolveTerritoryFromPathname("/minsk/kuda", { db }))!.type, "REGION");
  assert.equal((await resolveTerritoryFromPathname("/kopishche", { db }))!.type, "CITY");

  // Reserved segments and invalid slugs never reach the database.
  const before = calls.length;
  assert.equal(await resolveTerritoryFromPathname("/blog/x", { db }), null);
  assert.equal(await resolveTerritoryFromPathname("/admin", { db }), null);
  assert.equal(await resolveTerritoryBySlug("a/b", { db }), null);
  assert.equal(await resolveTerritoryBySlug("", { db }), null);
  assert.equal(calls.length, before);

  // Active-only by default.
  assert.equal((calls[0] as { where: { isActive?: boolean } }).where.isActive, true);
  console.log("resolveTerritory.test: ok");
}

void main();
