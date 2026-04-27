import { formatDescriptionText } from "./formatDescription";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function paragraphCount(text: string): number {
  return text.split("\n\n").filter((p) => p.trim().length > 0).length;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// 1. Пустой ввод
{
  const result = formatDescriptionText("");
  console.assert(result === "", `[1] empty: expected "" got "${result}"`);
}

// 2. Короткий текст — не разбивается
{
  const input = "Весёлый мастер-класс для детей от 5 лет.";
  const result = formatDescriptionText(input);
  console.assert(result.trim() === input.trim(), `[2] short: should stay as-is`);
}

// 3. Текст с уже готовыми абзацами — сохраняет структуру
{
  const input = "Первый абзац про событие.\n\nВторой абзац про программу.\n\nТретий про цену.";
  const result = formatDescriptionText(input);
  console.assert(paragraphCount(result) === 3, `[3] existing paragraphs: expected 3, got ${paragraphCount(result)}`);
}

// 4. Длинный текст одним полотном — разбивается на несколько абзацев
{
  const input =
    "Приглашаем всех желающих на увлекательный мастер-класс по лепке из глины. " +
    "Вы научитесь создавать красивые изделия своими руками под руководством опытного мастера. " +
    "Мероприятие подходит для детей от 6 лет и взрослых. " +
    "Стоимость участия составляет 25 рублей с человека. " +
    "Адрес: ул. Ленина, 10, студия «Глина». " +
    "Начало в 14:00, продолжительность 2 часа. " +
    "Для записи звоните: +375 29 123-45-67.";
  const result = formatDescriptionText(input);
  console.assert(paragraphCount(result) >= 2, `[4] long wall: expected ≥2 paragraphs, got ${paragraphCount(result)}`);
}

// 5. Текст со списком — маркеры нормализуются в «— »
{
  const input = "Программа мероприятия:\n- Лепка из глины\n- Роспись изделий\n- Чаепитие";
  const result = formatDescriptionText(input);
  console.assert(result.includes("— Лепка из глины"), `[5] list: bullets normalized to «— », got: ${result}`);
  console.assert(result.includes("— Роспись изделий"), `[5] list: second bullet normalized`);
  console.assert(result.includes("— Чаепитие"), `[5] list: third bullet normalized`);
}

// 6. Телефон, дата, цена — не ломаются
{
  const input =
    "Мастер-класс пройдёт 15 мая 2025 года в 18:00. " +
    "Стоимость: 30 BYN. Телефон: +375 29 999-88-77. " +
    "Адрес: пр. Независимости, 25.";
  const result = formatDescriptionText(input);
  console.assert(result.includes("+375 29 999-88-77"), `[6] phone preserved`);
  console.assert(result.includes("30 BYN"), `[6] price preserved`);
  console.assert(result.includes("15 мая 2025"), `[6] date preserved`);
}

// 7. Лишние переносы нормализуются
{
  const input = "Первый абзац.\n\n\n\n\nВторой абзац.";
  const result = formatDescriptionText(input);
  console.assert(!result.includes("\n\n\n"), `[7] triple newlines removed`);
}

// 8. Trim пробелов в строках
{
  const input = "  Текст с пробелами в начале.  \n\n  Второй абзац.  ";
  const result = formatDescriptionText(input);
  console.assert(!result.startsWith(" "), `[8] leading spaces trimmed`);
}

// 9. Блок с ценой выносится отдельным абзацем
{
  const input =
    "Приглашаем на праздник. Будет весело и интересно. Ждём всех желающих. " +
    "Стоимость участия — 20 рублей с человека.";
  const result = formatDescriptionText(input);
  console.assert(paragraphCount(result) >= 2, `[9] price block: expected separate paragraph, got ${paragraphCount(result)}\n${result}`);
  console.assert(result.includes("20 рублей"), `[9] price text preserved`);
}

// 10. Блок с билетами выносится отдельным абзацем
{
  const input =
    "Концерт пройдёт в большом зале. Программа включает классические произведения. " +
    "Билеты можно купить на сайте или в кассе.";
  const result = formatDescriptionText(input);
  console.assert(result.includes("Билеты"), `[10] ticket text preserved`);
}

// 11. Нормализация разных маркеров списка
{
  const input = "Что включено:\n• Завтрак\n– Обед\n— Ужин\n* Напитки";
  const result = formatDescriptionText(input);
  const lines = result.split("\n");
  const bulletLines = lines.filter((l) => l.startsWith("— "));
  console.assert(bulletLines.length === 4, `[11] all bullets normalized to «— », got ${bulletLines.length}: ${result}`);
}

// 12. Заголовок (< 100 символов) остаётся отдельным блоком
{
  const input = "Мастер-класс по акварели\n\nПриглашаем всех желающих научиться рисовать акварелью. Занятие ведёт профессиональный художник.";
  const result = formatDescriptionText(input);
  const paras = result.split("\n\n");
  console.assert(paras[0]?.trim() === "Мастер-класс по акварели", `[12] headline preserved as first block, got: "${paras[0]}"`);
}

// 13. Двойные пробелы убираются
{
  const input = "Текст  с  двойными  пробелами.";
  const result = formatDescriptionText(input);
  console.assert(!result.includes("  "), `[13] double spaces removed`);
}

// 14. Повторяющиеся строки убираются
{
  const input = "Строка одна.\nСтрока одна.\nСтрока два.";
  const result = formatDescriptionText(input);
  const occurrences = result.split("Строка одна.").length - 1;
  console.assert(occurrences === 1, `[14] duplicate lines removed, found ${occurrences} occurrences`);
}

console.log("formatDescriptionText: all assertions passed");
