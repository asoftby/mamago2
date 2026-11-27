import assert from "node:assert/strict";
import { test } from "node:test";
import type { DirectMessage } from "@prisma/client";
import { toDirectSendMessageDto } from "./directMessageDto";

test("Direct send DTO omits staff identity and moderation metadata", () => {
  const message = {
    id: "msg-1", threadId: "thread-1", senderType: "BUSINESS",
    senderUserId: "private-staff-user-id", body: "Hello",
    createdAt: new Date("2026-11-20T00:00:00Z"), readAt: null,
    hiddenAt: null, hiddenByUserId: "moderator-id", hiddenReason: "SPAM",
  } as unknown as DirectMessage;
  const dto = toDirectSendMessageDto(message);
  assert.deepEqual(Object.keys(dto).sort(), [
    "body", "createdAt", "hiddenAt", "id", "readAt", "senderType", "threadId",
  ].sort());
  assert.equal(dto.body, "Hello");
  assert.equal(JSON.stringify(dto).includes("private-staff-user-id"), false);
  assert.equal(JSON.stringify(dto).includes("moderator-id"), false);
});
