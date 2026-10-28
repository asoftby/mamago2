#!/usr/bin/env node
// CI verification after retargeting PR #851 to dev.
/**
 * Проверка русификации админки (ТЗ «Аналитика админки», блок E).
 *
 * Ищет в `src/app/admin`, `src/components/admin` и админских сервисах:
 *   - видимые английские строки: текст в JSX, атрибуты (title, placeholder,
 *     aria-label, alt, label, description, hint …) и поля объектов
 *     (label/title/description/hint/placeholder/subtitle/caption/heading/message …);
 *   - английские локали дат и чисел (`en-US`, `en-CA`, `en-GB`);
 *   - `toLocale*String()` без локали (зависит от ОС сервера/браузера).
 *
 * Бренды, сервисы и технические термины (Telegram, Google Search Console,
 * robots.txt, canonical, JSON-LD, URL, API …) разрешены — см. ALLOWED_TOKENS.
 *
 * Режим «храповик»: текущие нарушения записаны в `scripts/admin-ru-baseline.json`
 * (файл -> число). Проверка падает, если в файле нарушений стало БОЛЬШЕ, чем в
 * базе, или они появились в новом файле. По мере перевода экранов базу
 * уменьшают: `node scripts/check-admin-ru.mjs --update`. Цель — пустая база.
 *
 * Использование:
 *   node scripts/check-admin-ru.mjs            # CI: код 1 при росте нарушений
 *   node scripts/check-admin-ru.mjs --update   # пересохранить базу (только уменьшение)
 *   node scripts/check-admin-ru.mjs --list     # показать все нарушения
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SCAN_ROOTS = [
  "src/app/admin",
  "src/components/admin",
  "src/server/services/analytics",
  "src/lib/admin",
  "src/lib/analytics",
];

/** Файлы, где английский текст — не интерфейс (тесты, моки, типы, чистая логика без подписей). */
const SKIP_FILE = /\.(test|spec|stories)\.[tj]sx?$|\/__tests__\/|\.d\.ts$/;

/** Слова, которые можно оставлять латиницей: бренды, сервисы, форматы, общепринятые аббревиатуры. */
export const ALLOWED_TOKENS = new Set(
  [
    "Telegram", "Google", "Search", "Console", "Instagram", "Facebook", "Viber", "WhatsApp", "YouTube", "TikTok", "VK",
    "Yandex", "Bing", "Email", "E-mail", "Gmail", "Resend", "Sentry", "Prisma", "Postgres", "PostgreSQL", "Redis", "Docker",
    "Next", "React", "OpenAI", "Claude", "GPT", "AI", "GA4", "GSC", "SEO", "B2B", "B2C", "CTA", "CTR", "KPI", "UTM", "URL", "URLs",
    "API", "ID", "IDs", "IP", "UI", "UX", "CSV", "JSON", "JSON-LD", "HTML", "XML", "PDF", "SVG", "PNG", "JPG", "JPEG", "WebP", "GIF",
    "HTTP", "HTTPS", "SSL", "TLS", "DNS", "SQL", "CMS", "SLA", "SMS", "UNP", "УНП", "VAT", "NDA",
    "robots.txt", "sitemap.xml", "llms.txt", "canonical", "noindex", "nofollow", "schema.org", "hreflang", "slug", "sitemap",
    "iOS", "Android", "Chrome", "Safari", "Firefox", "Mac", "Windows", "Linux",
    "Core", "Web", "Vitals", "LCP", "INP", "CLS", "TTFB", "FCP",
    "mamaGo", "Mamago", "MamaGo", "BYN", "USD", "EUR", "RUB", "OK", "N/A", "WordPress", "Phoenix",
    "DAU", "WAU", "MAU", "WPF", "W1", "W4",
  ].map((t) => t.toLowerCase()),
);

const TEXT_KEYS = "label|title|description|hint|placeholder|subtitle|caption|heading|helperText|emptyText|tooltip|message|text|headline";
const ATTR_KEYS = "title|placeholder|aria-label|alt|label|description|hint|helperText|emptyText|tooltip|subtitle|caption|heading|confirmLabel|submitLabel";

const WORD = /[A-Za-z][A-Za-z'’]*(?:[.-][A-Za-z]+)*/g;

/** true, если строка — видимый английский текст (а не код, путь, класс или разрешённый термин). */
export function isVisibleEnglish(raw) {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return false;
  if (/[А-Яа-яЁё]/.test(text)) return false;
  if (/^[\d\s.,:;%+\-–—/\\()[\]{}<>=!?*&^$#@|~"'`_]*$/.test(text)) return false;
  if (/^(https?:|\/|\.\/|\.\.\/|@\/|#|mailto:|tel:|data:)/.test(text)) return false;
  if (/^[A-Z0-9_]+$/.test(text)) return false; // коды enum: показ сырого кода ловит ревью, не эта проверка
  if (/^[a-z0-9_.:/\-[\]]+$/.test(text) && !text.includes(" ")) return false; // идентификатор / ключ / путь
  if (/\$\{|\bclassName\b|=>|[;=]|\w\(|\)\s*[;,]?$|[a-z][A-Z]/.test(text)) return false; // похоже на код
  const words = (text.match(WORD) ?? []).filter((w) => !ALLOWED_TOKENS.has(w.toLowerCase()));
  const real = words.filter((w) => w.length >= 3 || /^[A-Z][a-z]$/.test(w));
  if (real.length === 0) return false;
  if (real.length >= 2) return true;
  // Одно слово: считаем английским только «Заглавное» / целое слово из ≥4 букв.
  return /^[A-Z][a-z]{3,}$/.test(real[0]) || /^[a-z]{4,}$/.test(real[0]);
}

function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

function stripComments(source) {
  // Сохраняем длину и переводы строк, чтобы номера строк не поехали.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));
}

/** Находит нарушения в исходнике одного файла. */
export function findViolations(source, file = "file.tsx") {
  const code = stripComments(source);
  const out = [];
  const add = (index, kind, text) => out.push({ line: lineOf(source, index), kind, text: text.replace(/\s+/g, " ").trim().slice(0, 90) });

  for (const m of code.matchAll(/\b(en-US|en-CA|en-GB|en-AU)\b/g)) add(m.index, "locale", m[0]);
  for (const m of code.matchAll(/\.toLocale(?:Date|Time)?String\(\s*(?:undefined\s*)?\)/g)) add(m.index, "locale", m[0]);

  if (/\.tsx$/.test(file)) {
    // Текст между тегами: <b>Text</b>, <Tag prop>Text</Tag>
    for (const m of code.matchAll(/(?<![\w$)\]])<\/?[A-Za-z][\w.]*(?:\s[^<>]*?)?\/?>\s*([^<>{}\n][^<>{}]*?)\s*(?=<)/g)) {
      const text = m[1];
      if (text && !/^[):?|&]/.test(text.trim()) && isVisibleEnglish(text)) add(m.index + m[0].indexOf(text), "jsx-text", text);
    }
    // Многострочный текст внутри тега
    for (const m of code.matchAll(/>\s*\n\s*([A-Za-z][^<>{}\n]*)\n/g)) {
      if (!/^[):?|&]/.test(m[1].trim()) && isVisibleEnglish(m[1])) add(m.index + m[0].indexOf(m[1]), "jsx-text", m[1]);
    }
    // Атрибуты: title="Text"
    for (const m of code.matchAll(new RegExp(`\\s(?:${ATTR_KEYS})=(?:"([^"]*)"|'([^']*)')`, "g"))) {
      const text = m[1] ?? m[2];
      if (isVisibleEnglish(text)) add(m.index, "attr", text);
    }
    // Атрибуты-выражения: title={"Text"}
    for (const m of code.matchAll(new RegExp(`\\s(?:${ATTR_KEYS})=\\{\\s*(?:"([^"]*)"|'([^']*)'|\`([^\`$]*)\`)\\s*\\}`, "g"))) {
      const text = m[1] ?? m[2] ?? m[3];
      if (isVisibleEnglish(text)) add(m.index, "attr", text);
    }
  }
  // Поля объектов: label: "Text"
  for (const m of code.matchAll(new RegExp(`(?:^|[\\s{,(])(?:${TEXT_KEYS}):\\s*(?:"([^"\\n]*)"|'([^'\\n]*)'|\`([^\`$\\n]*)\`)`, "gm"))) {
    const text = m[1] ?? m[2] ?? m[3];
    if (isVisibleEnglish(text)) add(m.index, "field", text);
  }
  return out;
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      walk(full, acc);
    } else if (/\.(tsx|ts)$/.test(e.name)) acc.push(full);
  }
  return acc;
}

export function scan(root) {
  const result = {};
  const details = {};
  for (const r of SCAN_ROOTS) {
    for (const file of walk(path.join(root, r))) {
      const rel = path.relative(root, file).split(path.sep).join("/");
      if (SKIP_FILE.test(rel)) continue;
      const v = findViolations(fs.readFileSync(file, "utf8"), rel);
      if (v.length) {
        result[rel] = v.length;
        details[rel] = v;
      }
    }
  }
  return { counts: result, details };
}

export function compareWithBaseline(counts, baseline) {
  const grew = [];
  const shrunk = [];
  for (const [file, n] of Object.entries(counts)) {
    const allowed = baseline[file] ?? 0;
    if (n > allowed) grew.push({ file, now: n, allowed });
  }
  for (const [file, allowed] of Object.entries(baseline)) {
    const n = counts[file] ?? 0;
    if (n < allowed) shrunk.push({ file, now: n, allowed });
  }
  return { grew, shrunk };
}

function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, "..");
  const baselinePath = path.join(here, "admin-ru-baseline.json");
  const args = new Set(process.argv.slice(2));
  const { counts, details } = scan(root);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (args.has("--list")) {
    for (const [file, list] of Object.entries(details)) for (const v of list) console.log(`${file}:${v.line} [${v.kind}] ${v.text}`);
    console.log(`\nВсего: ${total} в ${Object.keys(counts).length} файлах`);
    return;
  }

  const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, "utf8")) : {};
  const { grew, shrunk } = compareWithBaseline(counts, baseline);

  if (args.has("--update")) {
    if (grew.length && fs.existsSync(baselinePath)) {
      console.error("Нельзя пересохранить базу: нарушений стало больше. Переведите строки:");
      for (const g of grew) console.error(`  ${g.file}: ${g.now} > ${g.allowed}`);
      process.exit(1);
    }
    const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(baselinePath, JSON.stringify(sorted, null, 2) + "\n");
    console.log(`База обновлена: ${total} нарушений в ${Object.keys(sorted).length} файлах`);
    return;
  }

  if (grew.length) {
    console.error("Русификация админки: найдены новые английские строки или английские локали дат/чисел.\n");
    for (const g of grew) {
      console.error(`${g.file}: ${g.now} (разрешено ${g.allowed})`);
      for (const v of details[g.file]) console.error(`  ${g.file}:${v.line} [${v.kind}] ${v.text}`);
    }
    console.error("\nПереведите строки на русский (словари — src/lib/admin/labels.ru.ts, даты — src/lib/admin/formatRu.ts).");
    console.error("Бренды и технические термины добавляются в ALLOWED_TOKENS этого скрипта только по согласованию.");
    process.exit(1);
  }
  console.log(`Русификация админки: ${total} строк в базе (${Object.keys(counts).length} файлов), роста нет.`);
  if (shrunk.length) console.log(`Можно уменьшить базу (${shrunk.length} файлов): node scripts/check-admin-ru.mjs --update`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
