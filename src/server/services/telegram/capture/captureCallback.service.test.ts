import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { createCaptureCallbackService } from "./captureCallback.service";
import { draft } from "./captureDraft.testkit";

test("target callback switches between me and whole family, never leaving a child assigned", async () => {
  const stored = {
    draft: draft({ entries: [{ ...draft().entries[0]!, child: { childId: "previous-child", raw: "Степан", state: "inferred" } }] }),
    draftVersion: 1,
    ruleCodes: ["CHILD_ASKED", "CAPTURE_TARGET_CHILD"],
  };
  const updates: Array<Record<string, unknown>> = [];
  const answered: string[] = [];
  const presented: string[] = [];
  const db = {
    inboxItem: {
      async findFirst() { return structuredClone(stored); },
      async updateMany(args: { data: { draft: typeof stored.draft; ruleCodes: string[] } }) {
        stored.draft = args.data.draft;
        stored.ruleCodes = args.data.ruleCodes;
        stored.draftVersion += 1;
        updates.push(args.data as unknown as Record<string, unknown>);
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;

  const callbacks = createCaptureCallbackService({
    db,
    channel: {
      async answerCallbackQuery({ text }) { answered.push(text ?? ""); },
      async editMessageText() {},
      async sendMessage() { return { message_id: 1 }; },
    },
    presenter: { async present(id) { presented.push(id); } },
  });

  const parsed = {
    kind: "callback" as const, callbackQueryId: "q", data: null, fromUserId: 5, chatId: 5, messageId: 7,
  };
  await callbacks.handle({ userId: "owner" }, parsed, { kind: "inbox_target", inboxItemId: "draft-1", target: "me" });
  assert.equal(stored.draft.entries[0]?.child.childId, null);
  assert.deepEqual(stored.ruleCodes, ["CAPTURE_TARGET_ME"]);
  await callbacks.handle({ userId: "owner" }, parsed, { kind: "inbox_target", inboxItemId: "draft-1", target: "all" });
  assert.deepEqual(stored.ruleCodes, ["CAPTURE_TARGET_ALL"]);
  assert.equal(stored.draft.entries[0]?.child.state, "missing");
  assert.deepEqual(answered, ["Готово", "Готово"]);
  assert.deepEqual(presented, ["draft-1", "draft-1"]);
  assert.equal(updates.length, 2);
});
