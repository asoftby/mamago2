import assert from "node:assert";
import { resolveArticlePublicationActionPolicy } from "./articlePublicationActionPolicy";

const draft = resolveArticlePublicationActionPolicy({
  status: "DRAFT",
  canModerate: true,
  hasUnsavedChanges: true,
  hasPublicUrl: false,
});
assert.deepStrictEqual(draft.primary, { kind: "submit", label: "Отправить на модерацию" });
assert.strictEqual(draft.showQuietSave, true);
assert.strictEqual(draft.showReject, false);
assert.strictEqual(draft.showPublicLink, false);

const pendingAdmin = resolveArticlePublicationActionPolicy({
  status: "PENDING",
  canModerate: true,
  hasUnsavedChanges: false,
  hasPublicUrl: true,
});
assert.deepStrictEqual(pendingAdmin.primary, { kind: "approve", label: "Одобрить и опубликовать" });
assert.strictEqual(pendingAdmin.showQuietSave, false);
assert.strictEqual(pendingAdmin.showReject, true);
assert.strictEqual(pendingAdmin.showPublicLink, false);

const pendingAuthor = resolveArticlePublicationActionPolicy({
  status: "PENDING",
  canModerate: false,
  hasUnsavedChanges: false,
  hasPublicUrl: false,
});
assert.strictEqual(pendingAuthor.primary, null);
assert.strictEqual(pendingAuthor.showReject, false);

const published = resolveArticlePublicationActionPolicy({
  status: "PUBLISHED",
  canModerate: true,
  hasUnsavedChanges: true,
  hasPublicUrl: true,
});
assert.deepStrictEqual(published.primary, {
  kind: "save",
  label: "Обновить публикацию",
  disabled: false,
});
assert.strictEqual(published.showPublicLink, true);
assert.strictEqual(published.showReject, false);

const rejected = resolveArticlePublicationActionPolicy({
  status: "REJECTED",
  canModerate: true,
  hasUnsavedChanges: false,
  hasPublicUrl: false,
});
assert.deepStrictEqual(rejected.primary, { kind: "submit", label: "Исправить и отправить снова" });
assert.strictEqual(rejected.showQuietSave, true);

for (const policy of [draft, pendingAdmin, pendingAuthor, published, rejected]) {
  assert.ok(policy.primary == null || typeof policy.primary.kind === "string", "at most one primary action");
  assert.strictEqual(policy.showPreview, true);
}

console.log("article publication action policy tests: OK");
