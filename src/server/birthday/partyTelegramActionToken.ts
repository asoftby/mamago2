import { createHmac, timingSafeEqual } from "node:crypto";

// Telegram callback_data is limited to 64 bytes. Bind to the private
// recipient chat and authenticate with a server-only secret.
const PREFIX = "pc1";
const MAX_AGE_MINUTES = 60 * 24;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,36}$/;

type ConfirmationAction = {
  kind: "CONFIRM";
  requestId: string;
  quoteVersion: number;
  issuedMinute: number;
};

function sign(data: string, chatId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(data).update("\0").update(chatId)
    .digest("base64url").slice(0, 12);
}

export function createPartyConfirmCallback(input: {
  requestId: string;
  quoteVersion: number;
  chatId: string;
  secret: string;
  now?: number;
}): string {
  if (!ID_PATTERN.test(input.requestId) || !Number.isSafeInteger(input.quoteVersion) ||
      input.quoteVersion < 1 || !/^\d+$/.test(input.chatId) || !input.secret) {
    throw new Error("Invalid party callback input");
  }
  const issuedMinute = Math.floor((input.now ?? Date.now()) / 60_000);
  const data = [PREFIX, input.requestId, input.quoteVersion.toString(36), issuedMinute.toString(36)].join(":");
  const token = `${data}:${sign(data, input.chatId, input.secret)}`;
  if (Buffer.byteLength(token, "utf8") > 64) throw new Error("Telegram callback exceeds 64 bytes");
  return token;
}

export function verifyPartyConfirmCallback(input: {
  token: string;
  chatId: string;
  secret: string;
  now?: number;
}): ConfirmationAction | null {
  if (!input.secret || !/^\d+$/.test(input.chatId) ||
      Buffer.byteLength(input.token, "utf8") > 64) return null;
  const parts = input.token.split(":");
  if (parts.length !== 5 || parts[0] !== PREFIX || !ID_PATTERN.test(parts[1]) ||
      !/^[0-9a-z]+$/.test(parts[2]) || !/^[0-9a-z]+$/.test(parts[3]) ||
      !/^[A-Za-z0-9_-]{12}$/.test(parts[4])) return null;
  const quoteVersion = parseInt(parts[2], 36);
  const issuedMinute = parseInt(parts[3], 36);
  const nowMinute = Math.floor((input.now ?? Date.now()) / 60_000);
  if (!Number.isSafeInteger(quoteVersion) || quoteVersion < 1 ||
      !Number.isSafeInteger(issuedMinute) || issuedMinute > nowMinute ||
      nowMinute - issuedMinute > MAX_AGE_MINUTES) return null;
  const data = parts.slice(0, 4).join(":");
  const expected = Buffer.from(sign(data, input.chatId, input.secret));
  const actual = Buffer.from(parts[4]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return { kind: "CONFIRM", requestId: parts[1], quoteVersion, issuedMinute };
}
