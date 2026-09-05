import assert from "node:assert/strict";
import { getPublicPublishedPlaceWhere } from "@/server/public/publicContentVisibility";
import { loadArticlePlaceAdminPreview } from "./articlePlaceAdminPreview";

const run = async (publicAvailable: boolean, previewExists = true) => {
  let publicWhere: unknown;
  const result = await loadArticlePlaceAdminPreview("p1", { place: {
    findUnique: async () => previewExists ? ({ title: "Place", shortAddress: "Address", formattedAddr: null, city: { name: "Минск" } }) : null,
    findFirst: async (args) => { publicWhere = args.where; return publicAvailable ? { id: "p1" } : null; },
  } });
  return { result, publicWhere };
};

async function main() {
  const visible = await run(true);
  assert.equal(visible.result?.publicAvailable, true, "published Place with active owner is available");
  assert.deepEqual(visible.publicWhere, { AND: [{ id: "p1" }, getPublicPublishedPlaceWhere()] });

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
