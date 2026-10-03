import { CAPTURE_LIMITS } from "./captureLimits";

/** Subset of the Telegram Bot API Update that the capture path reads. */
export type RawTelegramPhotoSize = { file_id: string; width?: number; height?: number; file_size?: number };

type RawMessageOrigin = { type?: string; date?: number };

type RawEntity = { type?: string; offset?: number };

export type RawTelegramMessage = {
  message_id?: number;
  date?: number;
  text?: string;
  caption?: string;
  entities?: RawEntity[];
  caption_entities?: RawEntity[];
  photo?: RawTelegramPhotoSize[];
  media_group_id?: string;
  forward_origin?: RawMessageOrigin;
  chat?: { id?: number; type?: string };
  from?: { id?: number; is_bot?: boolean };
};

export type RawTelegramUpdate = {
  update_id?: number;
  message?: RawTelegramMessage;
  callback_query?: {
    id?: string;
    data?: string;
    from?: { id?: number };
    message?: { message_id?: number; chat?: { id?: number } };
  };
};

export type CapturePartKind = "TEXT" | "PHOTO" | "UNSUPPORTED";
export type CaptureSourceKind = "TEXT" | "FORWARD" | "PHOTO";

export type ParsedCapture = {
  kind: "capture";
  updateId: number;
  chatId: number;
  fromUserId: number;
  messageId: number;
  partKind: CapturePartKind;
  /** `text` or `caption`, trimmed; null when absent. */
  text: string | null;
  /** file_id of the chosen photo size (<= max bytes); null otherwise. */
  fileId: string | null;
  /** A photo is present but every size exceeds the limit. */
  photoTooLarge: boolean;
  mediaGroupId: string | null;
  sourceKind: CaptureSourceKind;
  anchorAt: Date;
  anchorIsForward: boolean;
};

export type ParsedCallback = {
  kind: "callback";
  callbackQueryId: string;
  data: string | null;
  fromUserId: number | null;
  chatId: number | null;
  messageId: number | null;
};

export type ParsedIgnore = { kind: "ignore"; reason: string };

export type ParsedTelegramUpdate = ParsedCapture | ParsedCallback | ParsedIgnore;

function ignore(reason: string): ParsedIgnore {
  return { kind: "ignore", reason };
}

function hasLeadingCommand(entities: RawEntity[] | undefined): boolean {
  return Array.isArray(entities) && entities.some((e) => e?.type === "bot_command" && e.offset === 0);
}

/**
 * Picks the largest photo size not above `maxBytes`. Sizes without file_size
 * are accepted (unknown). Returns `tooLarge` when photos exist but none fit.
 */
export function selectPhotoSize(
  sizes: RawTelegramPhotoSize[] | undefined,
  maxBytes: number = CAPTURE_LIMITS.maxPhotoBytes,
): { fileId: string | null; tooLarge: boolean } {
  const valid = (sizes ?? []).filter((size) => typeof size?.file_id === "string" && size.file_id.length > 0);
  if (valid.length === 0) return { fileId: null, tooLarge: false };

  const fitting = valid.filter((size) => size.file_size == null || size.file_size <= maxBytes);
  if (fitting.length === 0) return { fileId: null, tooLarge: true };

  const area = (size: RawTelegramPhotoSize) => (size.width ?? 0) * (size.height ?? 0);
  const best = fitting.reduce((acc, size) => {
    const accScore = acc.file_size ?? area(acc);
    const sizeScore = size.file_size ?? area(size);
    return sizeScore >= accScore ? size : acc;
  });
  return { fileId: best.file_id, tooLarge: false };
}

/**
 * Date anchor: `forward_origin.date` when the forward carries one (all four
 * MessageOrigin variants: user, hidden_user, chat, channel), otherwise
 * `message.date`. Defensive: any missing/invalid date falls back.
 */
export function resolveAnchor(message: RawTelegramMessage): { anchorAt: Date; anchorIsForward: boolean } | null {
  const originDate = message.forward_origin?.date;
  if (typeof originDate === "number" && Number.isFinite(originDate) && originDate > 0) {
    return { anchorAt: new Date(originDate * 1000), anchorIsForward: true };
  }
  if (typeof message.date === "number" && Number.isFinite(message.date) && message.date > 0) {
    return { anchorAt: new Date(message.date * 1000), anchorIsForward: false };
  }
  return null;
}

/** Pure: no DB, no network. */
export function parseTelegramUpdate(update: RawTelegramUpdate | null | undefined): ParsedTelegramUpdate {
  if (!update || typeof update !== "object") return ignore("EMPTY_UPDATE");

  if (update.callback_query) {
    const query = update.callback_query;
    if (typeof query.id !== "string" || query.id.length === 0) return ignore("CALLBACK_WITHOUT_ID");
    return {
      kind: "callback",
      callbackQueryId: query.id,
      data: typeof query.data === "string" ? query.data : null,
      fromUserId: typeof query.from?.id === "number" ? query.from.id : null,
      chatId: typeof query.message?.chat?.id === "number" ? query.message.chat.id : null,
      messageId: typeof query.message?.message_id === "number" ? query.message.message_id : null,
    };
  }

  const message = update.message;
  if (!message) return ignore("UNSUPPORTED_UPDATE_TYPE");

  if (message.chat?.type !== "private" || typeof message.chat.id !== "number") return ignore("NOT_PRIVATE_CHAT");
  if (typeof message.from?.id !== "number") return ignore("NO_SENDER");
  if (message.from.is_bot === true) return ignore("FROM_BOT");
  if (typeof update.update_id !== "number") return ignore("NO_UPDATE_ID");
  if (typeof message.message_id !== "number") return ignore("NO_MESSAGE_ID");

  if (hasLeadingCommand(message.entities) || hasLeadingCommand(message.caption_entities)) {
    return ignore("COMMAND");
  }

  const anchor = resolveAnchor(message);
  if (!anchor) return ignore("NO_DATE");

  const hasPhoto = Array.isArray(message.photo) && message.photo.length > 0;
  const rawText = typeof message.text === "string" ? message.text : message.caption;
  const text = typeof rawText === "string" && rawText.trim().length > 0 ? rawText.trim() : null;
  const photo = hasPhoto ? selectPhotoSize(message.photo) : { fileId: null, tooLarge: false };

  const partKind: CapturePartKind = hasPhoto ? "PHOTO" : text !== null ? "TEXT" : "UNSUPPORTED";
  const sourceKind: CaptureSourceKind = message.forward_origin ? "FORWARD" : hasPhoto ? "PHOTO" : "TEXT";

  return {
    kind: "capture",
    updateId: update.update_id,
    chatId: message.chat.id,
    fromUserId: message.from.id,
    messageId: message.message_id,
    partKind,
    text,
    fileId: photo.fileId,
    photoTooLarge: photo.tooLarge,
    mediaGroupId: typeof message.media_group_id === "string" && message.media_group_id ? message.media_group_id : null,
    sourceKind,
    anchorAt: anchor.anchorAt,
    anchorIsForward: anchor.anchorIsForward,
  };
}
