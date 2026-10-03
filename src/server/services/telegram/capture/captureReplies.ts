/** Short user-facing replies of the intake. Russian, one place. */
export const CAPTURE_REPLIES = {
  rateLimited: "На сегодня достаточно: я принимаю не больше 30 сообщений в сутки. Попробуйте позже.",
  textTooLong: "Сообщение слишком длинное. Пришлите покороче, до 4000 символов.",
  photoTooLarge: "Картинка слишком большая. Пришлите скриншот поменьше, до 5 МБ.",
  unsupported: "Пока принимаю текст и скриншоты.",
} as const;

export type CaptureReplyKey = keyof typeof CAPTURE_REPLIES;
