/**
 * LABEL (RU/BE/EN) -> VALUE (kebab-case slug) для Discovery справочников.
 *
 * Правила:
 * - транслитерировать кириллицу в латиницу
 * - lowercase
 * - все разделители (space/_//&/+ и похожие) -> '-'
 * - оставить только [a-z0-9-]
 * - схлопнуть множественные дефисы в один
 * - trim дефисов по краям
 * - пустая/грязная строка -> ""
 */

const CYRILLIC_MAP: Record<string, string> = {
  a: "a",
  b: "b",
  c: "c",
  d: "d",
  e: "e",
  f: "f",
  g: "g",
  h: "h",
  i: "i",
  j: "j",
  k: "k",
  l: "l",
  m: "m",
  n: "n",
  o: "o",
  p: "p",
  r: "r",
  s: "s",
  t: "t",
  u: "u",
  v: "v",
  w: "w",
  x: "x",
  y: "y",
  z: "z",

  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",

  // Беларусь (и близкие латинизации)
  і: "i",
  ў: "u",
  ґ: "g",
  є: "e",
};

function transliterateCyrillicToLatin(input: string): string {
  const s = input.toLowerCase();
  return s
    .split("")
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join("");
}

function slugifyKebab(input: string): string {
  // Remove diacritics (e.g. "Café" -> "Cafe") after transliteration step
  const withoutDiacritics = input.normalize("NFD").replace(/\p{Diacritic}/gu, "");

  return withoutDiacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // spaces + `_`, `/`, `&`, `+`, punctuation -> '-'
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function slugifyLabelToValue(label: string): string {
  const raw = (label ?? "").trim();
  if (!raw) return "";

  const translit = transliterateCyrillicToLatin(raw);
  const slug = slugifyKebab(translit);

  return slug || "";
}

