/**
 * Валидация scripts/data/wp-redirect-map.json против БД (read-only).
 *
 * Запуск:
 *   set -a; source .env; set +a; npx tsx scripts/validate-redirect-map.ts
 *
 * Обязательно прогонять после импорта WP-контента: если импортер сгенерирует
 * slug'и, отличные от destination в манифесте, редиректы молча уйдут в 404.
 *
 * Проверки (см. src/lib/seo/redirectManifestClassifier.ts — единственная
 * реализация; тот же классификатор используют scripts/validate-redirect-map.ts
 * и /admin/seo/redirects, чтобы не разойтись):
 *   1. Каждый destination резолвится в живую сущность:
 *      /{city}/events/{slug} → Activity (+ ActivitySlugHistory),
 *      /{city}/blog/{slug} и /blog/{slug} → Article (+ ArticleSlugHistory),
 *      /{city}/places|offers/{slug} → Place/Offer (+ history);
 *      листинговые цели (/minsk, /minsk/events, …) проверяются структурно через City.
 *   2. Цепочки/циклы: destination одной записи является source другой.
 *   3. Дубли source (после percent-декодирования и нормализации).
 *   4. Формат source: percent-encoding, регистр, слэши.
 *   5. Статус найденных сущностей: не-PUBLISHED — предупреждение (не ошибка).
 *
 * Вывод: summary в stdout + CSV со всеми проблемами в scripts/tmp/.
 * Exit code 1, если есть broken targets, цепочки или дубли
 * (формат-замечания и unpublished — только предупреждения).
 *
 * Бейзлайн на пустой базе (893 записи, июль 2026): 45 OK (листинги),
 * 848 broken (сущностей ещё нет), 15 формат-замечаний (сырая кириллица/«ў»,
 * верхний регистр), 0 дублей, 0 цепочек. После импорта broken должен стать 0.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  loadWpRedirectManifestEntries,
  classifyRedirectManifest,
} from "../src/lib/seo/redirectManifestClassifier";

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(SCRIPTS_DIR, "data/wp-redirect-map.json");
const OUT_DIR = path.join(SCRIPTS_DIR, "tmp");

const prisma = new PrismaClient();

async function main() {
  const manifest = loadWpRedirectManifestEntries(MANIFEST_PATH);
  const result = await classifyRedirectManifest(prisma, manifest);

  const okCount = result.entries.filter(
    (e) => e.disposition === "EXACT_REDIRECT" || e.disposition === "VALID_HUB_REMAP" || e.disposition === "P1_START_OR_CONTAINS",
  ).length;

  // ---------- вывод ----------
  const report = {
    dbUrlHost: (process.env.DATABASE_URL ?? "").replace(/\/\/[^@]*@/, "//***@"),
    total: result.total,
    ok: okCount,
    okButUnpublished: result.unpublished.length,
    brokenTargets: result.brokenTargets.length,
    brokenByTable: result.brokenByTable,
    chains: result.chains.length,
    duplicates: result.duplicates.length,
    formatErrors: result.formatErrors.length,
  };
  console.log("=== SUMMARY ===");
  console.log(JSON.stringify(report, null, 2));

  console.log("\n=== LISTING TARGETS (by clicks) ===");
  const categoryEntries = result.entries
    .filter((e) => e.disposition === "VALID_HUB_REMAP" || e.disposition === "P1_START_OR_CONTAINS")
    .sort((a, b) => b.clicks - a.clicks);
  for (const e of categoryEntries) {
    console.log(`${e.clicks.toString().padStart(6)}  ${e.type || "-"}  ${e.source}  →  ${e.destination}  →  ${e.reason ?? "?"}`);
  }

  console.log("\n=== UNPUBLISHED (entity found, not PUBLISHED) ===");
  for (const p of result.unpublished) console.log(`${p.source} → ${p.target} :: ${p.reason}`);

  console.log("\n=== CHAINS ===");
  for (const p of result.chains) console.log(`${p.source} :: ${p.reason}`);

  console.log("\n=== DUPLICATES ===");
  for (const p of result.duplicates) console.log(`${p.source} → ${p.target} :: ${p.reason}`);

  console.log("\n=== FORMAT ERRORS ===");
  for (const p of result.formatErrors) console.log(`${p.source} :: ${p.reason}`);

  // CSV: все проблемные записи (broken + unpublished + chains + duplicates + format)
  const csvRows = [["source", "target", "reason"]];
  const push = (list: { source: string; target: string; reason: string }[], prefix: string) => {
    for (const p of list) csvRows.push([p.source, p.target, `${prefix}: ${p.reason}`]);
  };
  push(result.brokenTargets, "broken-target");
  push(result.unpublished, "unpublished");
  push(result.chains, "chain");
  push(result.duplicates, "duplicate-source");
  push(result.formatErrors, "format");
  const csv = csvRows
    .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
    .join("\n");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const csvPath = path.join(OUT_DIR, "redirect-map-validation.csv");
  fs.writeFileSync(csvPath, csv);
  console.log(`\nCSV written: ${csvPath} (${csvRows.length - 1} rows)`);

  console.log("\n=== DISPOSITION CLASSIFICATION ===");
  console.log(JSON.stringify(result.counts, null, 2));

  const classificationRows = [["source", "type", "disposition", "destination", "clicks"]];
  for (const e of result.entries) {
    classificationRows.push([e.source, e.type, e.disposition, e.destination, String(e.clicks)]);
  }
  const classificationCsv = classificationRows
    .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
    .join("\n");
  const classificationCsvPath = path.join(OUT_DIR, "redirect-disposition-classification.csv");
  fs.writeFileSync(classificationCsvPath, classificationCsv);
  console.log(`Classification CSV written: ${classificationCsvPath} (${result.total} rows)`);

  console.log("\n=== SOURCE COLLIDES WITH RESERVED APP ROOT SEGMENT ===");
  for (const e of result.rootRouteCollisions) console.log(`${e.source} → ${e.destination}`);

  // формат-замечания и unpublished — предупреждения; остальное — ошибка
  if (result.brokenTargets.length || result.chains.length || result.duplicates.length) {
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
