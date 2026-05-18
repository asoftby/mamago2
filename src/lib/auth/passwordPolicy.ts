import { z } from "zod";

/**
 * Минимальная длина пароля (MVР).
 * Применяется только при создании/смене пароля, не затрагивает логин или существующих пользователей.
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Максимальная длина пароля (защита от DoS через огромные строки).
 */
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Сообщение об ошибке для пароля, не прошедшего валидацию.
 */
export const PASSWORD_ERROR_MESSAGE = "Пароль должен быть не короче 8 символов";

/**
 * Zod-схема пароля. Использовать во всех формах создания/смены пароля.
 *
 * Правила:
 * - string
 * - trim НЕ применяется (пробелы внутри пароля разрешены)
 * - min 8
 * - max 128
 * - единая generic error
 */
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH, PASSWORD_ERROR_MESSAGE).max(PASSWORD_MAX_LENGTH);

/**
 * Функция для проверки пароля вне Zod (например, в клиентских хуках).
 *
 * @returns объект с полем `valid` и опциональным `error`
 */
export function validatePasswordPolicy(password: string): { valid: true } | { valid: false; error: string } {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: PASSWORD_ERROR_MESSAGE };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { valid: false, error: PASSWORD_ERROR_MESSAGE };
  }
  return { valid: true };
}
