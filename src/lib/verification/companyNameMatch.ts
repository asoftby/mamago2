/**
 * Нестрогое сравнение введённого пользователем названия компании с
 * официальным названием из ГРП. Список организационно-правовых форм не
 * исчерпывающий — расширять по мере встречи новых false positive/negative.
 */
const LEGAL_FORM_TOKENS = [
  "общество с ограниченной ответственностью",
  "открытое акционерное общество",
  "закрытое акционерное общество",
  "унитарное предприятие",
  "частное унитарное предприятие",
  "производственное унитарное частное предприятие",
  "индивидуальный предприниматель",
  "сельскохозяйственный производственный кооператив",
  "кооператив",
  "фирма",
  "ооо",
  "оао",
  "зао",
  "одо",
  "чуп",
  "тчуп",
  "пучп",
  "уп",
  "ип",
  "спк",
];

// Длинные фразы удаляем раньше коротких, иначе короткий токен может съесть
// часть более длинной фразы и оставить "хвост" (например "частное" от
// "частное унитарное предприятие", если сначала вырезать "унитарное предприятие").
const LEGAL_FORM_TOKENS_BY_LENGTH_DESC = [...LEGAL_FORM_TOKENS].sort(
  (a, b) => b.length - a.length,
);

export function normalizeCompanyName(name: string): string {
  let normalized = name.toLowerCase();
  normalized = normalized.replace(/["'«»„“”]/g, " ");
  normalized = normalized.replace(/[.,]/g, " ");
  normalized = normalized.replace(/\s+/g, " ").trim();

  // \b не распознаёт границы слов на кириллице — вместо regex-границ вырезаем
  // токены, окружённые пробелами, из строки с добавленными по краям пробелами.
  let padded = ` ${normalized} `;
  for (const token of LEGAL_FORM_TOKENS_BY_LENGTH_DESC) {
    padded = padded.split(` ${token} `).join(" ");
  }

  return padded.replace(/\s+/g, " ").trim();
}

/**
 * true, если введённое название "похоже" на одно из официальных названий
 * (точное совпадение после нормализации либо вхождение одной строки в другую
 * — покрывает сокращения вида "Тайга" vs "Кооператив «Тайга»").
 */
export function companyNamesLikelyMatch(
  inputName: string,
  officialNames: Array<string | null | undefined>,
): boolean {
  const normalizedInput = normalizeCompanyName(inputName);
  if (!normalizedInput) return false;

  return officialNames.some((official) => {
    if (!official) return false;
    const normalizedOfficial = normalizeCompanyName(official);
    if (!normalizedOfficial) return false;

    return (
      normalizedInput === normalizedOfficial ||
      normalizedOfficial.includes(normalizedInput) ||
      normalizedInput.includes(normalizedOfficial)
    );
  });
}
