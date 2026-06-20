export const LOGIN_SUCCESS_MESSAGES = [
  "Добро пожаловать в mamaGo!",
  "Вход выполнен — всё готово.",
  "Готово, вход выполнен.",
  "Всё готово для новых семейных планов.",
  "Можно продолжать планировать семейное время.",
];

export function getRandomLoginSuccessMessage() {
  return LOGIN_SUCCESS_MESSAGES[
    Math.floor(Math.random() * LOGIN_SUCCESS_MESSAGES.length)
  ];
}
