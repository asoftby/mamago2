/** Short user-facing replies of the intake. Russian, one place. */
export const CAPTURE_REPLIES = {
  rateLimited: "На сегодня лимит сообщений исчерпан. Попробуйте завтра.",
  globalRateLimited: "Сейчас сервис не принимает новые сообщения. Попробуйте позже.",
  photoRateLimited: "Лимит скриншотов на сегодня исчерпан. Можете добавить запись текстом.",
  textTooLong: "Сообщение слишком длинное. Пришлите покороче, до 4000 символов.",
  photoTooLarge: "Картинка слишком большая. Пришлите скриншот поменьше, до 3 МБ.",
  unsupported: "Пока принимаю текст и скриншоты.",
} as const;

export type CaptureReplyKey = keyof typeof CAPTURE_REPLIES;

/** Pending input replaces the entire recognized draft rather than applying a field edit. */
export const CAPTURE_REPLACE_TEXT_RULE = "CAPTURE_REPLACE_TEXT_AWAITING";

/** One user-facing status per accepted capture; later replaced with the preview. */
export const CAPTURE_PROCESSING_REPLIES = {
  TEXT: "Сообщение получено, разбираю, в течение минуты сброшу на проверку",
  PHOTO: "Сообщение получено, разбираю, в течение минуты сброшу на проверку",
} as const;

/** Stored with the draft; no schema change and no untrusted user-supplied IDs. */
export const CAPTURE_TARGET_ME_RULE = "CAPTURE_TARGET_ME";
export const CAPTURE_TARGET_ALL_RULE = "CAPTURE_TARGET_ALL";
export const CAPTURE_TARGET_CHILD_RULE = "CAPTURE_TARGET_CHILD";
export const CAPTURE_TARGET_RULES = [
  CAPTURE_TARGET_ME_RULE,
  CAPTURE_TARGET_ALL_RULE,
  CAPTURE_TARGET_CHILD_RULE,
] as const;
export const CAPTURE_EDIT_ACCEPTED_REPLY = "Правки приняты, вношу изменения";

export const CAPTURE_PROCESSING_FAILED_TEXT =
  "Не получилось распознать сообщение. Отправьте его ещё раз или напишите название, дату и время текстом.";
