import assert from "node:assert/strict";
import type { ContentStatus } from "@prisma/client";
import { getPublicPublishedPlaceWhere } from "@/server/public/publicContentVisibility";
import { loadArticlePlaceAdminPreview } from "./articlePlaceAdminPreview";

const run = async (publicAvailable: boolean, previewExists = true, status: ContentStatus = "PUBLISHED") => {
  let publicWhere: unknown;
  const result = await loadArticlePlaceAdminPreview("p1", { place: {
    findUnique: async () => previewExists ? ({ status, title: "Place", shortAddress: "Address", formattedAddr: null, city: { name: "Минск" } }) : null,
    findFirst: async (args) => { publicWhere = args.where; return publicAvailable ? { id: "p1" } : null; },
  } });
  return { result, publicWhere };
};

async function main() {
  const visible = await run(true);
  assert.equal(visible.result?.publicAvailable, true, "published Place with active owner is available");
  assert.deepEqual(visible.publicWhere, { AND: [{ id: "p1" }, getPublicPublishedPlaceWhere()] });

  assert.equal(visible.result?.availability, "public");

  // DRAFT/PENDING/NEEDS_REVISION: place exists and is editable → "draft", never "unavailable".
  for (const status of ["DRAFT", "PENDING", "NEEDS_REVISION"] as const) {
    const draft = await run(false, true, status);
    assert.equal(draft.result?.availability, "draft", `${status} is shown as a draft reference`);
    assert.equal(draft.result?.publicAvailable, false, "draft is still not public");
    assert.equal(draft.result?.title, "Place");
  }
  for (const status of ["ARCHIVED", "DELETED", "REJECTED"] as const) {
    assert.equal((await run(false, true, status)).result?.availability, "unavailable", `${status} is unavailable`);
  }
  // Published place hidden only because the owner is disabled → unavailable, not a draft.
  assert.equal((await run(false, true, "PUBLISHED")).result?.availability, "unavailable");

  for (const state of ["draft", "archived", "disabled-owner"] as const) {
    const hidden = await run(false);
    assert.equal(hidden.result?.publicAvailable, false, `${state} is unavailable by canonical query`);
    assert.equal(hidden.result?.title, "Place", "admin keeps the reference editable");
  }
  assert.equal((await run(false, false)).result, null);

  await assert.rejects(
    loadArticlePlaceAdminPreview("p1", { place: { findUnique: async () => { throw new Error("db down"); }, findFirst: async () => null } }),
    /db down/,
    "unexpected DB failures are not converted to unavailable content",
  );
  console.log("articlePlaceAdminPreview.test.ts: OK");
}

void main();
