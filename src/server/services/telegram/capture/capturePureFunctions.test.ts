import assert from "node:assert/strict";
import test from "node:test";
import { isCaptureEnabledForUser, parseCaptureAllowlist } from "./captureAllowlist";
import { CALLBACK_DATA_MAX_BYTES, decodeCallback, encodeCallback } from "./callbackCodec";
import {
  parseTelegramUpdate,
  selectPhotoSize,
  type ParsedCapture,
  type RawTelegramMessage,
  type RawTelegramUpdate,
} from "./telegramUpdateParser";

const MSG_DATE = 1_790_000_000;

function message(extra: Partial<RawTelegramMessage> = {}): RawTelegramMessage {
  return {
    message_id: 10,
    date: MSG_DATE,
    chat: { id: 555, type: "private" },
    from: { id: 555, is_bot: false },
    text: "Экскурсия 9 октября",
    ...extra,
  };
}

function update(extra: Partial<RawTelegramMessage> = {}, updateId = 1): RawTelegramUpdate {
  return { update_id: updateId, message: message(extra) };
}

function asCapture(raw: RawTelegramUpdate): ParsedCapture {
  const parsed = parseTelegramUpdate(raw);
  assert.equal(parsed.kind, "capture", JSON.stringify(parsed));
  return parsed as ParsedCapture;
}

test("plain text becomes a TEXT capture anchored at message.date", () => {
  const parsed = asCapture(update());
  assert.equal(parsed.partKind, "TEXT");
  assert.equal(parsed.sourceKind, "TEXT");
  assert.equal(parsed.text, "Экскурсия 9 октября");
  assert.equal(parsed.anchorAt.getTime(), MSG_DATE * 1000);
  assert.equal(parsed.anchorIsForward, false);
  assert.equal(parsed.mediaGroupId, null);
  assert.equal(parsed.updateId, 1);
  assert.equal(parsed.chatId, 555);
  assert.equal(parsed.fromUserId, 555);
});

test("forward anchors on forward_origin.date for all four MessageOrigin variants", () => {
  const originDate = 1_789_000_000;
  const origins = [
    { type: "user", date: originDate, sender_user: { id: 1 } },
    { type: "hidden_user", date: originDate, sender_user_name: "Anna" },
    { type: "chat", date: originDate, sender_chat: { id: -1 } },
    { type: "channel", date: originDate, chat: { id: -2 }, message_id: 5 },
  ];
  for (const origin of origins) {
    const parsed = asCapture(update({ forward_origin: origin as never }));
    assert.equal(parsed.sourceKind, "FORWARD", origin.type);
    assert.equal(parsed.anchorAt.getTime(), originDate * 1000, origin.type);
    assert.equal(parsed.anchorIsForward, true, origin.type);
  }
});

test("forward_origin without a usable date falls back to message.date and is not marked forward-anchored", () => {
  const parsed = asCapture(update({ forward_origin: { type: "hidden_user" } }));
  assert.equal(parsed.sourceKind, "FORWARD");
  assert.equal(parsed.anchorAt.getTime(), MSG_DATE * 1000);
  assert.equal(parsed.anchorIsForward, false);
});

test("a screenshot without forward_origin is PHOTO with message.date anchor", () => {
  const parsed = asCapture(
    update({ text: undefined, caption: "  афиша  ", photo: [{ file_id: "a", width: 90, height: 90, file_size: 1000 }] }),
  );
  assert.equal(parsed.partKind, "PHOTO");
  assert.equal(parsed.sourceKind, "PHOTO");
  assert.equal(parsed.text, "афиша");
  assert.equal(parsed.fileId, "a");
  assert.equal(parsed.anchorIsForward, false);
});

test("forwarded photo is FORWARD with the origin anchor", () => {
  const parsed = asCapture(
    update({
      text: undefined,
      photo: [{ file_id: "a", file_size: 10 }],
      forward_origin: { type: "user", date: 1_789_000_000 },
    }),
  );
  assert.equal(parsed.sourceKind, "FORWARD");
  assert.equal(parsed.partKind, "PHOTO");
  assert.equal(parsed.anchorIsForward, true);
});

test("album part keeps media_group_id", () => {
  const parsed = asCapture(update({ text: undefined, photo: [{ file_id: "a" }], media_group_id: "grp1" }));
  assert.equal(parsed.mediaGroupId, "grp1");
});

test("photo size selection picks the largest not above the limit", () => {
  const limit = 5 * 1024 * 1024;
  assert.deepEqual(
    selectPhotoSize(
      [
        { file_id: "s", width: 90, height: 90, file_size: 1_000 },
        { file_id: "m", width: 320, height: 320, file_size: 50_000 },
        { file_id: "l", width: 800, height: 800, file_size: 400_000 },
        { file_id: "xl", width: 2000, height: 2000, file_size: limit + 1 },
      ],
      limit,
    ),
    { fileId: "l", tooLarge: false },
  );
  assert.deepEqual(selectPhotoSize([{ file_id: "xl", file_size: limit + 1 }], limit), { fileId: null, tooLarge: true });
  assert.deepEqual(selectPhotoSize([], limit), { fileId: null, tooLarge: false });
  assert.deepEqual(
    selectPhotoSize([{ file_id: "a", width: 10, height: 10 }, { file_id: "b", width: 100, height: 100 }], limit),
    { fileId: "b", tooLarge: false },
  );
});

test("an oversized-only photo is flagged and has no fileId", () => {
  const parsed = asCapture(update({ text: undefined, photo: [{ file_id: "x", file_size: 6 * 1024 * 1024 }] }));
  assert.equal(parsed.photoTooLarge, true);
  assert.equal(parsed.fileId, null);
});

test("unsupported content (no text, no photo) is a capture with UNSUPPORTED part", () => {
  const parsed = asCapture(update({ text: undefined, caption: undefined }));
  assert.equal(parsed.partKind, "UNSUPPORTED");
});

test("commands are ignored, including /start with payload", () => {
  const start = parseTelegramUpdate(
    update({ text: "/start link_abc", entities: [{ type: "bot_command", offset: 0 }] }),
  );
  assert.deepEqual(start, { kind: "ignore", reason: "COMMAND" });
  const captionCommand = parseTelegramUpdate(
    update({ text: undefined, caption: "/x", photo: [{ file_id: "a" }], caption_entities: [{ type: "bot_command", offset: 0 }] }),
  );
  assert.equal(captionCommand.kind, "ignore");
});

test("a bot_command entity that is not at offset 0 does not make it a command", () => {
  const parsed = parseTelegramUpdate(update({ text: "см. /start", entities: [{ type: "bot_command", offset: 4 }] }));
  assert.equal(parsed.kind, "capture");
});

test("non-private chats, bots, and unsupported update types are ignored", () => {
  assert.equal(parseTelegramUpdate(update({ chat: { id: -100, type: "supergroup" } })).kind, "ignore");
  assert.equal(parseTelegramUpdate(update({ chat: { id: 1, type: "group" } })).kind, "ignore");
  assert.equal(parseTelegramUpdate(update({ from: { id: 9, is_bot: true } })).kind, "ignore");
  assert.equal(parseTelegramUpdate({ update_id: 1 } as RawTelegramUpdate).kind, "ignore");
  assert.equal(parseTelegramUpdate({ update_id: 1, edited_message: {} } as unknown as RawTelegramUpdate).kind, "ignore");
  assert.equal(parseTelegramUpdate(null).kind, "ignore");
  assert.equal(parseTelegramUpdate({ message: message() }).kind, "ignore");
});

test("callback_query is parsed with its data", () => {
  const parsed = parseTelegramUpdate({
    update_id: 3,
    callback_query: { id: "cb", data: "inb:add:abc", from: { id: 5 }, message: { message_id: 7, chat: { id: 5 } } },
  });
  assert.deepEqual(parsed, {
    kind: "callback",
    callbackQueryId: "cb",
    data: "inb:add:abc",
    fromUserId: 5,
    chatId: 5,
    messageId: 7,
  });
});

test("callback codec round-trips every action", () => {
  for (const action of ["add", "edit", "no", "dup", "upd", "new"] as const) {
    const data = encodeCallback({ kind: "inbox", action, inboxItemId: "cmabc123" });
    assert.equal(data, `inb:${action}:cmabc123`);
    assert.deepEqual(decodeCallback(data), { kind: "inbox", action, inboxItemId: "cmabc123" });
  }
  const child = encodeCallback({ kind: "inbox_child", inboxItemId: "cmabc123", childId: "cmchild9" });
  assert.equal(child, "inb:child:cmabc123:cmchild9");
  assert.deepEqual(decodeCallback(child), { kind: "inbox_child", inboxItemId: "cmabc123", childId: "cmchild9" });
  const req = encodeCallback({ kind: "requirement_done", requirementId: "cmreq1" });
  assert.equal(req, "req:done:cmreq1");
  assert.deepEqual(decodeCallback(req), { kind: "requirement_done", requirementId: "cmreq1" });
});

test("callback codec rejects malformed data and foreign prefixes", () => {
  for (const data of [null, "", "application:1:confirm", "inb:", "inb:zzz:abc", "inb:add", "inb:add:a:b", "inb:child:a", "req:done", "req:undo:a", "req:done:a:b"]) {
    assert.equal(decodeCallback(data), null, String(data));
  }
});

test("callback codec enforces the 64-byte limit in UTF-8", () => {
  const maxId = "x".repeat(CALLBACK_DATA_MAX_BYTES - "inb:add:".length);
  assert.equal(encodeCallback({ kind: "inbox", action: "add", inboxItemId: maxId }).length, CALLBACK_DATA_MAX_BYTES);
  assert.throws(() => encodeCallback({ kind: "inbox", action: "add", inboxItemId: maxId + "x" }));
  // Multibyte ids exceed the byte limit even when the char count is under 64.
  assert.throws(() => encodeCallback({ kind: "inbox", action: "add", inboxItemId: "я".repeat(30) }));
  assert.throws(() => encodeCallback({ kind: "inbox", action: "add", inboxItemId: "a:b" }));
  assert.throws(() => encodeCallback({ kind: "inbox", action: "add", inboxItemId: "" }));
  assert.equal(decodeCallback(`inb:add:${"я".repeat(30)}`), null);
});

test("allowlist parser trims, drops empties and treats unset as off", () => {
  assert.deepEqual([...parseCaptureAllowlist(" a , b,, c ,")], ["a", "b", "c"]);
  assert.equal(parseCaptureAllowlist("").size, 0);
  assert.equal(parseCaptureAllowlist("  ,  ").size, 0);
  assert.equal(parseCaptureAllowlist(undefined).size, 0);
  assert.equal(parseCaptureAllowlist(null).size, 0);
  assert.equal(isCaptureEnabledForUser("a", " a, b"), true);
  assert.equal(isCaptureEnabledForUser("c", " a, b"), false);
  assert.equal(isCaptureEnabledForUser("a", ""), false);
  assert.equal(isCaptureEnabledForUser("a", undefined), false);
});
