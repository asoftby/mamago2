import assert from "node:assert/strict";
import test from "node:test";
import { resolveEditedPublicBack, safePublicBackPath } from "./publicEditReturn";

test("editor return Back restores the source journal listing with filters", () => {
  assert.equal(
    resolveEditedPublicBack("/minsk/blog/test-article", "/minsk/blog?category=ideas", "/minsk"),
    "/minsk/blog?category=ideas",
  );
  assert.equal(
    resolveEditedPublicBack("/blog/test-article", "/blog?filter=news", "/minsk"),
    "/blog?filter=news",
  );
});

test("direct article visit goes to its journal instead of navigating into the editor", () => {
  assert.equal(resolveEditedPublicBack("/minsk/blog/test-article", null, "/minsk"), "/minsk/blog");
  assert.equal(resolveEditedPublicBack("/blog/test-article", "/blog/test-article", "/minsk"), "/blog");
});

test("no changes to the ordinary page Back fallback", () => {
  assert.equal(resolveEditedPublicBack("/minsk/events/demo", null, "/minsk"), "/minsk");
});

test("external, editor and malformed origin values are rejected", () => {
  for (const path of [
    "https://example.com", "//evil.example", "/admin/content/articles/1/edit",
    "/business/dashboard", "/editor/offer/1", "/\\evil", "/ok\r\nbad",
  ]) {
    assert.equal(safePublicBackPath(path), null, path);
    assert.equal(resolveEditedPublicBack("/blog/my-article", path, "/minsk"), "/blog");
  }
  assert.equal(safePublicBackPath("/minsk/blog?category=events"), "/minsk/blog?category=events");
});
