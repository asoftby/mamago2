/**
 * Контекст шапки: публичный сайт, кабинет партнёра или админка.
 * Колокольчик уведомлений для `user` и `admin` использует stream «личный»; для `business` — настройки бизнес-каналов.
 */
export type HeaderChromeContext = "user" | "business" | "admin";
