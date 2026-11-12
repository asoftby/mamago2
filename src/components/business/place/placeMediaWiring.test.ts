import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// No network/DB is required for this architecture contract. The real file
// upload and media-library pagination pipelines have their own integration tests.
const read = (path: string) => readFileSync(path, "utf8");
const logo = read("src/components/business/place/PlaceLogoUploadTemp.tsx");
const gallery = read("src/components/business/place/PlaceGalleryUploadTemp.tsx");
const step = read("src/components/business/wizard/place/steps/Step4Photos.tsx");
const adapter = read("src/components/business/place/placeWizardMediaAdapter.ts");
const sessionRoute = read("src/app/api/business/temp-media/route.ts");
const reorderRoute = read("src/app/api/business/places/[id]/images/reorder/route.ts");

for (const source of [logo, gallery]) {
  assert.match(source, /<MediaUploadField\b/, "place media uses the shared picker UI");
  assert.match(source, /loadMediaLibraryPage=\{loadPlaceMediaLibraryPage\}/);
  assert.match(source, /uploadButtonLabel="Загрузить новое"/);
  assert.match(source, /disabled=\{[^}]*published\}/);
  assert.doesNotMatch(source, /document\.createElement\("input"\)/, "no private upload input");
}
assert.match(logo, /mode="single"/);
assert.match(gallery, /mode="multiple"/);
assert.match(gallery, /allowReorder/);
assert.match(gallery, /reorderSavedPlaceGallery/);
assert.match(gallery, /removeSavedPlaceImage/);
assert.match(gallery, /newlyAttachedIds/);
assert.match(gallery, /Promise\.allSettled\(newlyAttachedIds\.map\(/, "partial library selection must not leave invisible session images");
assert.match(step, /const isMediaEditable = isEditable && data\.status !== "PUBLISHED"/);
assert.match(step, /isEditable=\{isMediaEditable\}/, "Instagram import is gated alongside the picker");
assert.match(adapter, /\/api\/business\/media-picker/, "shared business library source");
assert.match(adapter, /mediaAssetId: assetId/, "attach stable asset ID, not user-supplied URL");
assert.match(adapter, /Promise\.allSettled\(items\.map\(/, "failed multi-upload must clean session records");
assert.match(sessionRoute, /uploadedById: user\.id/, "owner-bound media lookup");
assert.match(sessionRoute, /status: "ACTIVE", kind: "IMAGE"/, "only active images");
assert.match(sessionRoute, /resolvedUrl = asset\.publicUrl/, "URL must come from the database");
assert.match(sessionRoute, /prisma\.\$transaction\(/, "logo replacement is atomic");
assert.match(reorderRoute, /canManagePlaceAsync\(user, place\)/);
assert.match(reorderRoute, /place\.status === "PUBLISHED"/);

console.log("Place unified-media wiring contract: OK");
