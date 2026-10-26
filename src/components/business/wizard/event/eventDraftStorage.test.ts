import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { EventFormData } from "./types";
import { parseEventEditorDraft, serializeEventEditorDraft } from "./eventDraftStorage";

function fixture(occasionIds: string[], title: string): EventFormData {
  return { occasionIds, title } as EventFormData;
}

test("legacy session draft restores saved Halloween links without losing other edits", () => {
  const server = fixture(["halloween-id"], "Server title");
  const legacy = fixture([], "Unsaved editor title");
  const restored = parseEventEditorDraft(JSON.stringify(legacy), server, "edit");
  assert.deepEqual(restored?.occasionIds, ["halloween-id"]);
  assert.equal(restored?.title, "Unsaved editor title");
});

test("new drafts retain an intentional editor deselection", () => {
  const server = fixture(["halloween-id"], "Existing event");
  const draft = fixture([], "Existing event");
  const restored = parseEventEditorDraft(serializeEventEditorDraft(draft), server, "edit");
  assert.deepEqual(restored?.occasionIds, []);
});

test("draft round-trip preserves selecting a new occasion", () => {
  const server = fixture([], "Existing event");
  const draft = fixture(["halloween-id"], "Existing event");
  assert.deepEqual(
    parseEventEditorDraft(serializeEventEditorDraft(draft), server, "edit")?.occasionIds,
    ["halloween-id"],
  );
});

test("legacy new-event draft retains its choices", () => {
  const server = fixture([], "");
  const legacy = fixture(["halloween-id"], "New event");
  assert.deepEqual(
    parseEventEditorDraft(JSON.stringify(legacy), server, "create")?.occasionIds,
    ["halloween-id"],
  );
});

test("unrecognized or malformed draft cannot override the server state", () => {
  const server = fixture(["halloween-id"], "Saved");
  assert.equal(parseEventEditorDraft('{"version":999,"draft":{}}', server, "edit"), null);
  assert.equal(parseEventEditorDraft('{"version":1,"draft":null}', server, "edit"), null);
});

test("wizard loader provides actual occasionLinks and picker reflects saved selection", () => {
  const loader = readFileSync(new URL("../../../../lib/content-editor/loadEventForWizard.ts", import.meta.url), "utf8");
  const picker = readFileSync(new URL("../shared/OccasionPicker.tsx", import.meta.url), "utf8");
  assert.match(loader, /occasionLinks:\s*\{\s*select:\s*\{\s*occasionId:\s*true\s*\}/);
  assert.match(picker, /aria-pressed=\{selected\}/);
  assert.match(picker, /selected\s*\?\s*<Check/);
});
