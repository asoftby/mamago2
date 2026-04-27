/**
 * formatDescriptionText — post-processing formatter для AI rewrite описаний событий.
 *
 * Чистая функция, без React и API-зависимостей.
 * Принимает plain text (не HTML), возвращает plain text с нормальными абзацами.
 *
 * Логика:
 * 1. Нормализует пробелы и переносы
 * 2. Защищает первую строку-заголовок (< 100 символов)
 * 3. Выделяет логические блоки: цена, билеты, время
 * 4. Нормализует списки (—, -, •) в единый стиль
 * 5. Если абзацы уже есть — сохраняет их, только чистит
 * 6. Если текст пришёл одним полотном — разбивает по смысловым границам
 * 7. Длинные абзацы (>500 символов) разбивает дополнительно
 * 8. Убирает дубли, лишние пробелы, повторяющиеся строки
 * 9. НЕ меняет слова, НЕ добавляет факты, НЕ переводит язык
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Нормализует пробелы внутри строки, не трогая переносы. */
function normalizeSpaces(line: string): string {
  return line.replace(/[ \t]+/g, " ").trim();
}

/** Проверяет, является ли строка пунктом списка. */
function isBullet(line: string): boolean {
  return /^[-–—•*]\s/.test(line) || /^\d+[.)]\s/.test(line);
}

/** Нормализует маркер списка в единый стиль «— ». */
function normalizeBullet(line: string): string {
  return line.replace(/^[-–—•*]\s+/, "— ").replace(/^\d+[.)]\s+/, "— ");
}

/**
 * Разбивает длинный абзац на части по границам предложений.
 * Не разбивает если абзац ≤ maxLen символов.
 */
function splitLongParagraph(para: string, maxLen = 500): string[] {
  if (para.length <= maxLen) return [para];

  // Разбиваем по концу предложения: ". ", "! ", "? " — но не "г. ", "ул. ", "т. д. " и т.п.
  const sentenceEnd = /(?<=[.!?])\s+(?=[А-ЯA-ZЎІЁа-яa-zўіё"«\d])/g;
  const sentences = para.split(sentenceEnd).filter(Boolean);

  if (sentences.length <= 1) return [para];

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > maxLen && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.length > 0 ? chunks : [para];
}

// ─── Block detectors ──────────────────────────────────────────────────────────

/**
 * Проверяет, содержит ли строка/абзац информацию о цене.
 */
function isPriceBlock(text: string): boolean {
  return /\b(руб|рублей|BYN|бел\.?\s*руб|стоимость|кошт|цена|цену|коштуе|каштуе)\b/i.test(text);
}

/**
 * Проверяет, содержит ли строка/абзац информацию о билетах.
 */
function isTicketBlock(text: string): boolean {
  return /\b(квіткі|квитки|билеты|билет|набыць|купить|приобрести|регистрация|зарегистрироваться|зарэгістравацца)\b/i.test(text);
}

/**
 * Проверяет, содержит ли строка/абзац информацию о времени/расписании.
 */
function isTimeBlock(text: string): boolean {
  return /\b(з\s+\d{1,2}:\d{2}|с\s+\d{1,2}:\d{2}|начало|пачатак|расписание|расклад|время|час\b|часоў|часов)\b/i.test(text);
}

/**
 * Проверяет, является ли предложение «спецстрокой» — цена, билеты, время,
 * контакты, сайт, телефон. Такие строки выносятся отдельно.
 */
function isSpecialSentence(text: string): boolean {
  return (
    // Цена
    /^(Кошт|Стоимость|Цена|Цана)\s*[:—]/i.test(text) ||
    /\b(руб|рублей|BYN|бел\.?\s*руб)\b/i.test(text) ||
    // Билеты
    /^(Квіткі|Билеты|Білеты)\s*(можна|можно|можно)/i.test(text) ||
    // Время
    /\bз\s+\d{1,2}:\d{2}\b/.test(text) ||
    /\bда\s+\d{1,2}:\d{2}\b/.test(text) ||
    /\bс\s+\d{1,2}:\d{2}\b/.test(text) ||
    /\bдо\s+\d{1,2}:\d{2}\b/.test(text) ||
    // Контакты
    /\+\d[\d\s\-()]{6,}/.test(text) ||
    /\b(тэлефон|телефон)\s*[:—]/i.test(text) ||
    // Сайт / соцсети
    /https?:\/\//.test(text) ||
    /@[\w.]+/.test(text) ||
    /\b(сайт|сайце|сайта)\s*[:—]/i.test(text)
  );
}

/**
 * Проверяет, является ли абзац «смысловым блоком» (цена/билеты/время),
 * который нужно вынести отдельно.
 */
function isSpecialBlock(text: string): boolean {
  return isPriceBlock(text) || isTicketBlock(text) || isTimeBlock(text);
}

// ─── Special-line extractor ───────────────────────────────────────────────────

/**
 * Страховочный сплиттер: разбивает абзац > maxLen символов,
 * вынося спецстроки (цена, билеты, время, контакты) отдельными абзацами.
 */
function extractSpecialLines(para: string, maxLen = 320): string[] {
  if (para.length <= maxLen && !isSpecialSentence(para)) return [para];

  const sentences = splitSentences(para);
  if (sentences.length <= 1) return [para];

  const result: string[] = [];
  let current: string[] = [];

  for (const sentence of sentences) {
    const special = isSpecialSentence(sentence);

    if (special) {
      // Сбрасываем накопленный текст
      if (current.length > 0) {
        result.push(current.join(" "));
        current = [];
      }
      // Спецстрока — отдельным абзацем
      result.push(sentence);
    } else {
      current.push(sentence);
      // Разбиваем по 2 предложения если абзац уже длинный
      if (current.length >= 2 && current.join(" ").length > maxLen) {
        result.push(current.join(" "));
        current = [];
      }
    }
  }

  if (current.length > 0) result.push(current.join(" "));

  return result.filter(Boolean);
}

// ─── Sentence splitter ────────────────────────────────────────────────────────

/**
 * Разбивает текст на предложения, не ломая числа, даты, телефоны, цены.
 */
function splitSentences(text: string): string[] {
  // Защищаем сокращения: г., ул., пр., т.д., т.е., и т.п., руб., бел. и т.п.
  const protected_ = text
    .replace(/(\b(?:г|ул|пр|пл|пер|бул|наб|пр-т|т\.д|т\.е|и т\.п|руб|бел|тел|ст|им|обл|р-н|кв|д|корп|стр))\.\s+/gi, "$1.⟨SPACE⟩")
    .replace(/(\d+)\.\s+(\d)/g, "$1.⟨SPACE⟩$2"); // "10. 30" — не конец предложения

  const parts = protected_.split(/(?<=[.!?])\s+(?=[А-ЯA-ZЎІЁа-яa-zўіё"«\d])/g);

  return parts
    .map((s) => s.replace(/⟨SPACE⟩/g, " ").trim())
    .filter(Boolean);
}

// ─── Paragraph grouper ────────────────────────────────────────────────────────

/**
 * Группирует предложения в абзацы по 2–3 предложения,
 * разрывая перед смысловыми блоками (цена, билеты, время).
 */
function groupSentencesIntoParagraphs(sentences: string[]): string[] {
  if (sentences.length === 0) return [];
  if (sentences.length <= 2) return [sentences.join(" ")];

  const paragraphs: string[] = [];
  let current: string[] = [];

  for (const sentence of sentences) {
    const isSpecial = isSpecialBlock(sentence);
    const isShift = isTopicShift(current[current.length - 1] ?? "", sentence);

    // Разрываем перед специальным блоком или при смене темы после 2+ предложений
    const shouldBreak =
      (isSpecial && current.length > 0) ||
      (current.length >= 3 && isShift) ||
      (current.length >= 2 && isSpecial);

    if (shouldBreak) {
      if (current.length > 0) {
        paragraphs.push(current.join(" "));
        current = [];
      }
    }

    current.push(sentence);

    // Закрываем абзац после специального блока
    if (isSpecial) {
      paragraphs.push(current.join(" "));
      current = [];
    }
  }

  if (current.length > 0) paragraphs.push(current.join(" "));

  return paragraphs;
}

/**
 * Эвристика: начинает ли следующее предложение новую тему.
 */
function isTopicShift(prev: string, next: string): boolean {
  if (!prev || !next) return false;
  const topicMarkers = [
    /^(Для|Падыходзіць|Подходит|Возраст|Узрост|Дети|Дзеці|Взрослые|Дарослыя|Семьи|Сем'і|Участники|Удзельнікі)/i,
    /^(Стоимость|Кошт|Цена|Цана|Билеты|Квіткі|Вход|Уваход|Регистрация|Рэгістрацыя|Запись|Запіс)/i,
    /^(Место|Месца|Адрес|Адрас|Площадка|Пляцоўка|Проводится|Праводзіцца|Пройдёт|Адбудзецца|Состоится)/i,
    /^(Дата|Время|Час|Начало|Пачатак|Расписание|Расклад|График|Графік)/i,
    /^(Организатор|Арганізатар|Контакты|Кантакты|Телефон|Тэлефон|Связаться|Звязацца)/i,
    /^(Программа|Праграма|В программе|У праграме|Что ждёт|Вас ждёт|Участников ждёт)/i,
  ];
  return topicMarkers.some((re) => re.test(next.trim()));
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/** Убирает подряд идущие одинаковые строки. */
function deduplicateLines(lines: string[]): string[] {
  const result: string[] = [];
  for (const line of lines) {
    if (result[result.length - 1] !== line) {
      result.push(line);
    }
  }
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function formatDescriptionText(input: string): string {
  if (!input || !input.trim()) return "";

  // 1. Нормализуем переносы строк
  const normalized = input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  // 2. Разбиваем на строки и нормализуем пробелы
  const rawLines = normalized.split("\n").map(normalizeSpaces);

  // 3. Нормализуем маркеры списков
  const lines = rawLines.map((line) => (isBullet(line) ? normalizeBullet(line) : line));

  // 4. Определяем: есть ли уже структура (двойные переносы или списки)
  const hasExplicitParagraphs = /\n\s*\n/.test(normalized);
  const hasBullets = lines.some(isBullet);

  let paragraphs: string[];

  if (hasExplicitParagraphs || hasBullets) {
    // Текст уже структурирован — группируем по пустым строкам
    paragraphs = [];
    let current: string[] = [];

    for (const line of lines) {
      if (line === "") {
        if (current.length > 0) {
          paragraphs.push(current.join("\n"));
          current = [];
        }
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) paragraphs.push(current.join("\n"));
  } else {
    // Текст пришёл одним полотном — разбиваем по смысловым границам
    const fullText = lines.filter(Boolean).join(" ");
    const sentences = splitSentences(fullText);
    paragraphs = groupSentencesIntoParagraphs(sentences);
  }

  // 5. Защита заголовка: первая строка < 100 символов — отдельный блок
  const firstPara = paragraphs[0]?.trim() ?? "";
  const isHeadline = firstPara.length > 0 && firstPara.length < 100 && !firstPara.includes("\n");

  // 6. Обрабатываем каждый абзац
  const result: string[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]!.trim();
    if (!para) continue;

    // Заголовок — не разбиваем
    if (i === 0 && isHeadline) {
      result.push(para);
      continue;
    }

    // Блок со списком — не разбиваем, только нормализуем маркеры
    const paraLines = para.split("\n");
    if (paraLines.some(isBullet)) {
      const normalizedBullets = paraLines.map((l) =>
        isBullet(l) ? normalizeBullet(l) : l,
      );
      result.push(normalizedBullets.join("\n"));
      continue;
    }

    // Страховочный сплиттер: выносит спецстроки (цена, билеты, время, контакты)
    // и разбивает длинные абзацы по 2 предложения
    const extracted = extractSpecialLines(para, 320);
    if (extracted.length > 1) {
      result.push(...extracted);
      continue;
    }

    // Длинный абзац — разбиваем по предложениям
    const parts = splitLongParagraph(para, 500);
    result.push(...parts);
  }

  // 7. Убираем дубли строк внутри каждого абзаца
  const deduped = result.map((para) => {
    const paraLines = para.split("\n");
    return deduplicateLines(paraLines).join("\n");
  });

  // 8. Финальная сборка: двойной перенос между абзацами, не более 2 подряд
  return deduped
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
