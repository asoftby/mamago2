import assert from "node:assert";
import { resolveArticlePublicationActionPolicy } from "./articlePublicationActionPolicy";

const draft = resolveArticlePublicationActionPolicy({
  status: "DRAFT",
  canModerate: true,
  hasUnsavedChanges: true,
  hasPublicUrl: false,
});
assert.deepStrictEqual(draft.primary, { kind: "submit", label: "Опубликовать" }, "ADMIN/MODERATOR publish without queue");
assert.strictEqual(draft.showQuietSave, true);
assert.strictEqual(draft.showReject, false);
assert.strictEqual(draft.showPublicLink, false);

const pendingAdmin = resolveArticlePublicationActionPolicy({
  status: "PENDING",
  canModerate: true,
  hasUnsavedChanges: false,
  hasPublicUrl: true,
});
assert.deepStrictEqual(pendingAdmin.primary, {
  kind: "approve",
  label: "Одобрить и опубликовать",
  disabled: false,
  disabledReason: null,
});
assert.strictEqual(pendingAdmin.showQuietSave, false);
assert.strictEqual(pendingAdmin.showReject, true);
assert.strictEqual(pendingAdmin.showPublicLink, false);

const pendingAdminDirty = resolveArticlePublicationActionPolicy({
  status: "PENDING",
  canModerate: true,
  hasUnsavedChanges: true,
  hasPublicUrl: true,
});
assert.deepStrictEqual(pendingAdminDirty.primary, {
  kind: "approve",
  label: "Одобрить и опубликовать",
  disabled: true,
  disabledReason: "Сначала сохраните изменения",
});

// Non-moderators (business-style authors) keep the moderation queue wording.
const draftAuthor = resolveArticlePublicationActionPolicy({
  status: "DRAFT",
  canModerate: false,
  hasUnsavedChanges: true,
  hasPublicUrl: false,
});
assert.deepStrictEqual(draftAuthor.primary, { kind: "submit", label: "Отправить на модерацию" });
const rejectedAuthor = resolveArticlePublicationActionPolicy({
  status: "REJECTED",
  canModerate: false,
  hasUnsavedChanges: false,
  hasPublicUrl: false,
});
assert.deepStrictEqual(rejectedAuthor.primary, { kind: "submit", label: "Исправить и отправить снова" });

// Explicit draft save never publishes: the quiet save button stays and has no publish semantics.
assert.strictEqual(draft.showQuietSave, true);

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
assert.deepStrictEqual(rejected.primary, { kind: "submit", label: "Исправить и опубликовать" });
assert.strictEqual(rejected.showQuietSave, true);

for (const policy of [draft, pendingAdmin, pendingAdminDirty, pendingAuthor, published, rejected]) {
  assert.ok(policy.primary == null || typeof policy.primary.kind === "string", "at most one primary action");
  assert.strictEqual(policy.showPreview, true);
}

console.log("article publication action policy tests: OK");
