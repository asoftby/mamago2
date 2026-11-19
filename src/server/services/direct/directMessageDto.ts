import type { DirectMessage } from "@prisma/client";

/** Public send response: never expose the real staff sender or moderation metadata. */
export function toDirectSendMessageDto(message: DirectMessage) {
  return {
    id: message.id,
    threadId: message.threadId,
    senderType: message.senderType,
    body: message.body,
    createdAt: message.createdAt,
    readAt: message.readAt,
    hiddenAt: message.hiddenAt,
  };
}
