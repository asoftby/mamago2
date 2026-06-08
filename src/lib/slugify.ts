import { PrismaClient } from "@prisma/client";

/**
 * Cyrillic to Latin transliteration map
 */
const TRANSLITERATION_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Ё: "E", Ж: "Zh",
  З: "Z", И: "I", Й: "Y", К: "K", Л: "L", М: "M", Н: "N", О: "O",
  П: "P", Р: "R", С: "S", Т: "T", У: "U", Ф: "F", Х: "H", Ц: "Ts",
  Ч: "Ch", Ш: "Sh", Щ: "Sch", Ъ: "", Ы: "Y", Ь: "", Э: "E", Ю: "Yu", Я: "Ya",
  // Ukrainian
  і: "i", ї: "yi", є: "ye", ґ: "g",
  І: "I", Ї: "Yi", Є: "Ye", Ґ: "G",
};

/**
 * Convert Russian/Ukrainian text to SEO-friendly slug
 * 
 * @param text - Input text (can contain Cyrillic)
 * @returns SEO-friendly slug
 * 
 * @param emptyFallback — если после очистки строка пустая (по умолчанию `"place"` для обратной совместимости)
 *
 * @example
 * slugifyRu("Новое место") // "novoe-mesto"
 * slugifyRu("Детский клуб #1") // "detskiy-klub-1"
 * slugifyRu("Кафе \"Солнце\"") // "kafe-solntse"
 * slugifyRu("Пасхальный мастер-класс по выпечке кулича", "event") // "paskhalnyy-master-klass-po-vypechke-kulicha"
 */
export function slugifyRu(text: string, emptyFallback: string = "place"): string {
  let raw = typeof text === "string" ? text : "";
  if (!raw.trim()) {
    raw = emptyFallback || "item";
  }

  // Единые дефисы до транслита (длинное тире, минус и т.д.)
  let slug = raw.replace(/[\u2013\u2014\u2212\u2010\u00AD]/g, "-");

  // Transliterate Cyrillic to Latin
  slug = slug
    .split("")
    .map((char) => TRANSLITERATION_MAP[char] || char)
    .join("");

  // Convert to lowercase
  slug = slug.toLowerCase();

  // Replace spaces and common separators with hyphens
  slug = slug.replace(/[\s_]+/g, "-");

  // Remove special characters (keep only alphanumeric and hyphens)
  slug = slug.replace(/[^a-z0-9-]/g, "");

  // Collapse multiple hyphens into one
  slug = slug.replace(/-+/g, "-");

  // Remove leading and trailing hyphens
  slug = slug.replace(/^-+|-+$/g, "");

  // If empty after cleanup, return fallback (slugified once to stay [a-z0-9-])
  if (!slug) {
    const fb = emptyFallback.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "item";
    return fb.replace(/-+/g, "-").replace(/^-+|-+$/g, "") || "item";
  }

  return slug;
}

/**
 * Generate unique slug for a Place
 * If slug already exists, append number suffix (-2, -3, etc.)
 * 
 * @param prisma - Prisma client instance
 * @param title - Place title
 * @returns Unique slug
 * 
 * @example
 * await generateUniquePlaceSlug(prisma, "Новое место") // "novoe-mesto"
 * // If "novoe-mesto" exists:
 * await generateUniquePlaceSlug(prisma, "Новое место") // "novoe-mesto-2"
 */
export async function generateUniquePlaceSlug(
  prisma: PrismaClient,
  title: string
): Promise<string> {
  const baseSlug = slugifyRu(title);
  let slug = baseSlug;
  let counter = 2;

  // Check if slug exists and increment counter until we find unique one
  while (true) {
    const existing = await prisma.place.findFirst({
      where: { slug },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}
