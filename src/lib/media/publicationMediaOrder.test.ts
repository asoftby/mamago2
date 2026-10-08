import assert from "node:assert/strict";
import {
  mergePrimaryWithGallery,
  splitPrimaryFromGallery,
  uniquePublicationMedia,
} from "./publicationMediaOrder";

assert.deepEqual(uniquePublicationMedia([" A ", "A", "", null, "B", " B "]), ["A", "B"]);
assert.deepEqual(mergePrimaryWithGallery("cover", ["one", "cover", "two"]), ["cover", "one", "two"]);
assert.deepEqual(mergePrimaryWithGallery(null, ["one", "two"]), ["one", "two"]);
assert.deepEqual(splitPrimaryFromGallery(["one", "two", "one"]), {
  primary: "one",
  gallery: ["two"],
});
assert.deepEqual(splitPrimaryFromGallery([]), { primary: null, gallery: [] });
