/**
 * Валидация scripts/data/wp-redirect-map.json против БД (read-only).
 *
 * Запуск:
 *   set -a; source .env; set +a; npx tsx scripts/validate-redirect-map.ts
 *
 * Обязательно прогонять после импорта WP-контента: если импортер сгенерирует
 * slug'и, отличные от destination в манифесте, редиректы молча уйдут в 404.
 *
 * Проверки:
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

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(SCRIPTS_DIR, "data/wp-redirect-map.json");
const OUT_DIR = path.join(SCRIPTS_DIR, "tmp");

const prisma = new PrismaClient();

type Entry = {
  source: string;
  destination: string;
  permanent: boolean;
  type?: string;
  clicks?: number;
  confidence?: string;
};

type Problem = { source: string; target: string; reason: string };

function decodeSafe(s: string): { ok: boolean; decoded: string } {
  try {
    return { ok: true, decoded: decodeURIComponent(s) };
  } catch {
    return { ok: false, decoded: s };
  }
}

// Валидный сегмент legacy-WP source: latin/digits/-/_/. или валидный percent-encoding
const SEG_RE = /^(?:[a-z0-9._~-]|%[0-9a-fA-F]{2})+$/;

async function main() {
  const manifest: Entry[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

  // ---------- справочные данные из БД ----------
  const cities = await prisma.city.findMany({ select: { id: true, slug: true } });
  const cityBySlug = new Map(cities.map((c) => [c.slug.toLowerCase(), c.id]));

  // Все активности (включая slug=null): история может ссылаться на запись,
  // чей текущий slug уже другой или отсутствует.
  const allActivities = await prisma.activity.findMany({
    select: { id: true, slug: true, cityId: true, status: true, title: true },
  });
  const activityById = new Map(allActivities.map((a) => [a.id, a]));
  const actByKey = new Map<string, (typeof allActivities)[number]>();
  for (const a of allActivities) {
    if (a.slug) actByKey.set(`${a.cityId ?? ""}:${a.slug}`, a);
  }
  const actHist = await prisma.activitySlugHistory.findMany({
    select: { slug: true, cityId: true, activityId: true },
  });
  const actHistByKey = new Map<string, string>(); // key -> activityId
  for (const h of actHist) actHistByKey.set(`${h.cityId ?? ""}:${h.slug}`, h.activityId);

  const articles = await prisma.article.findMany({
    select: { id: true, slug: true, cityId: true, status: true, title: true },
  });
  const articleById = new Map(articles.map((a) => [a.id, a]));
  const articleByKey = new Map<string, (typeof articles)[number]>();
  const articleBySlugOnly = new Map<string, (typeof articles)[number][]>();
  for (const a of articles) {
    if (!a.slug) continue;
    articleByKey.set(`${a.cityId ?? ""}:${a.slug}`, a);
    const list = articleBySlugOnly.get(a.slug) ?? [];
    list.push(a);
    articleBySlugOnly.set(a.slug, list);
  }
  const artHist = await prisma.articleSlugHistory.findMany({
    select: { slug: true, cityId: true, articleId: true },
  });
  const artHistByKey = new Map<string, string>();
  const artHistBySlug = new Map<string, string>();
  for (const h of artHist) {
    artHistByKey.set(`${h.cityId ?? ""}:${h.slug}`, h.articleId);
    artHistBySlug.set(h.slug, h.articleId);
  }

  const places = await prisma.place.findMany({
    where: { slug: { not: null } },
    select: { id: true, slug: true, cityId: true, status: true },
  });
  const placeByKey = new Map(places.map((p) => [`${p.cityId ?? ""}:${p.slug}`, p]));
  const placeHist = await prisma.placeSlugHistory.findMany({
    select: { slug: true, cityId: true },
  });
  const placeHistKeys = new Set(placeHist.map((h) => `${h.cityId ?? ""}:${h.slug}`));

  const offers = await prisma.offer.findMany({
    where: { slug: { not: null } },
    select: { id: true, slug: true, cityId: true, status: true },
  });
  const offerByKey = new Map(offers.map((o) => [`${o.cityId ?? ""}:${o.slug}`, o]));
  const offerHist = await prisma.offerSlugHistory.findMany({
    select: { slug: true, cityId: true },
  });
  const offerHistKeys = new Set(offerHist.map((h) => `${h.cityId ?? ""}:${h.slug}`));

  // ---------- проверки ----------
  const formatErrors: Problem[] = [];
  const duplicates: Problem[] = [];
  const chains: Problem[] = [];
  const brokenTargets: Problem[] = [];
  const unpublished: Problem[] = [];
  const okEntries: Entry[] = [];
  const brokenByTable = new Map<string, number>();

  // 4) формат source
  for (const e of manifest) {
    const s = e.source;
    const problems: string[] = [];
    if (!s.startsWith("/")) problems.push("нет ведущего /");
    if (s !== s.trim()) problems.push("пробелы по краям");
    if (s.includes("//")) problems.push("двойной слэш");
    if (/[?#]/.test(s)) problems.push("query/fragment в source");
    if (s.length > 1 && s.endsWith("/")) problems.push("trailing slash (контракт манифеста — без него)");
    if (s !== s.toLowerCase()) problems.push("верхний регистр");
    const segs = s.split("/").filter(Boolean);
    if (segs.length === 0) problems.push("пустой путь");
    if (segs.length > 3) problems.push(`слишком глубокий путь (${segs.length} сегментов)`);
    for (const seg of segs) {
      if (!SEG_RE.test(seg)) problems.push(`недопустимые символы в сегменте "${seg}"`);
      if (!decodeSafe(seg).ok) problems.push(`битый percent-encoding в "${seg}"`);
    }
    if (problems.length) {
      formatErrors.push({ source: s, target: e.destination, reason: problems.join("; ") });
    }
  }

  // 3) дубли source (с учётом декодирования и нормализации)
  const normalize = (p: string) => decodeSafe(p).decoded.toLowerCase().replace(/\/+$/, "");
  const bySource = new Map<string, Entry[]>();
  for (const e of manifest) {
    const norm = normalize(e.source);
    const list = bySource.get(norm) ?? [];
    list.push(e);
    bySource.set(norm, list);
  }
  for (const [norm, list] of bySource) {
    if (list.length > 1) {
      const targets = [...new Set(list.map((x) => x.destination))];
      for (const e of list) {
        duplicates.push({
          source: e.source,
          target: e.destination,
          reason: `дубль source (${list.length} записей, целей: ${targets.length}${targets.length > 1 ? " — РАЗНЫЕ" : ""}), норм.: ${norm}`,
        });
      }
    }
  }

  // 2) цепочки/циклы: destination встречается как source другой записи
  const sourceSet = new Map<string, string>(); // normalized source -> destination
  for (const e of manifest) {
    sourceSet.set(normalize(e.source), e.destination);
  }
  for (const e of manifest) {
    const destNorm = normalize(e.destination.split("?")[0]);
    const srcNorm = normalize(e.source);
    if (destNorm === srcNorm) {
      chains.push({ source: e.source, target: e.destination, reason: "self-redirect (source == target)" });
      continue;
    }
    if (sourceSet.has(destNorm)) {
      // проследим цепочку до конца / цикла
      const hops: string[] = [e.source, e.destination];
      let cur = destNorm;
      let cycle = false;
      const seen = new Set([srcNorm, destNorm]);
      while (sourceSet.has(cur)) {
        const rawNext = sourceSet.get(cur)!;
        const next = normalize(rawNext.split("?")[0]);
        hops.push(rawNext);
        if (seen.has(next)) {
          cycle = true;
          break;
        }
        seen.add(next);
        cur = next;
      }
      chains.push({
        source: e.source,
        target: e.destination,
        reason: `${cycle ? "ЦИКЛ" : "цепочка"}: ${hops.join(" → ")}`,
      });
    }
  }

  // 1) резолвинг destination в сущность
  const CITY_LISTING_SECTIONS = new Set(["events", "classes", "birthday", "places", "blog", "offers", "routes"]);

  type Resolution =
    | { kind: "entity"; table: string; id: string; status: string; via: "direct" | "slug-history"; title?: string | null }
    | { kind: "listing"; route: string }
    | { kind: "broken"; reason: string; table: string };

  function diagnoseOtherTables(cityId: string | null, slug: string): string | null {
    const key = `${cityId ?? ""}:${slug}`;
    if (placeByKey.has(key)) return `slug найден в Place (status=${placeByKey.get(key)!.status})`;
    if (placeHistKeys.has(key)) return "slug найден в PlaceSlugHistory";
    if (offerByKey.has(key)) return `slug найден в Offer (status=${offerByKey.get(key)!.status})`;
    if (offerHistKeys.has(key)) return "slug найден в OfferSlugHistory";
    if (articleByKey.has(key)) return `slug найден в Article (status=${articleByKey.get(key)!.status})`;
    if (actByKey.has(key)) return `slug найден в Activity (status=${actByKey.get(key)!.status})`;
    return null;
  }

  function resolve(destRaw: string): Resolution {
    const dest = decodeSafe(destRaw.split("?")[0]).decoded;
    const segs = dest.split("/").filter(Boolean);

    if (segs.length === 0) return { kind: "broken", reason: "пустой target", table: "-" };

    // /blog/{slug} — статья странового охвата
    if (segs[0] === "blog" && segs.length === 2) {
      const slug = segs[1];
      const candidates = articleBySlugOnly.get(slug) ?? [];
      const art = candidates.find((a) => a.cityId == null) ?? candidates[0];
      if (art)
        return { kind: "entity", table: "Article", id: art.id, status: art.status, via: "direct", title: art.title };
      const histId = artHistBySlug.get(slug);
      if (histId) {
        const cur = articleById.get(histId);
        return {
          kind: "entity",
          table: "Article",
          id: histId,
          status: cur?.status ?? "UNKNOWN",
          via: "slug-history",
          title: cur?.title,
        };
      }
      return { kind: "broken", reason: "slug не найден (Article + history)", table: "Article" };
    }

    const citySlug = segs[0].toLowerCase();
    const cityId = cityBySlug.get(citySlug);
    if (!cityId) return { kind: "broken", reason: `город "${segs[0]}" не найден в City`, table: "City" };

    if (segs.length === 1) return { kind: "listing", route: `/${citySlug} (хаб города)` };

    const section = segs[1];
    if (segs.length === 2) {
      if (CITY_LISTING_SECTIONS.has(section)) return { kind: "listing", route: `/${citySlug}/${section} (листинг)` };
      return { kind: "broken", reason: `неизвестная секция "/${section}" под городом`, table: "-" };
    }

    const slug = segs.slice(2).join("/");
    const key = `${cityId}:${slug}`;

    if (section === "events") {
      const a = actByKey.get(key);
      if (a) return { kind: "entity", table: "Activity", id: a.id, status: a.status, via: "direct", title: a.title };
      const histActId = actHistByKey.get(key);
      if (histActId) {
        const cur = activityById.get(histActId);
        return {
          kind: "entity",
          table: "Activity",
          id: histActId,
          status: cur?.status ?? "UNKNOWN",
          via: "slug-history",
          title: cur?.title,
        };
      }
      const diag = diagnoseOtherTables(cityId, slug);
      return {
        kind: "broken",
        reason: `slug не найден (Activity + history)${diag ? "; " + diag : ""}`,
        table: "Activity",
      };
    }

    if (section === "blog") {
      const a = articleByKey.get(key);
      if (a) return { kind: "entity", table: "Article", id: a.id, status: a.status, via: "direct", title: a.title };
      const histId = artHistByKey.get(key);
      if (histId) {
        const cur = articleById.get(histId);
        return {
          kind: "entity",
          table: "Article",
          id: histId,
          status: cur?.status ?? "UNKNOWN",
          via: "slug-history",
          title: cur?.title,
        };
      }
      // статья могла остаться страновой (cityId=null) при городском URL
      const country = (articleBySlugOnly.get(slug) ?? [])[0];
      if (country)
        return {
          kind: "entity",
          table: "Article",
          id: country.id,
          status: country.status,
          via: "direct",
          title: country.title,
        };
      const diag = diagnoseOtherTables(cityId, slug);
      return { kind: "broken", reason: `slug не найден (Article + history)${diag ? "; " + diag : ""}`, table: "Article" };
    }

    if (section === "places") {
      const p = placeByKey.get(key);
      if (p) return { kind: "entity", table: "Place", id: p.id, status: p.status, via: "direct" };
      if (placeHistKeys.has(key)) return { kind: "entity", table: "Place", id: "?", status: "?", via: "slug-history" };
      return { kind: "broken", reason: "slug не найден (Place + history)", table: "Place" };
    }

    if (section === "offers") {
      const o = offerByKey.get(key);
      if (o) return { kind: "entity", table: "Offer", id: o.id, status: o.status, via: "direct" };
      if (offerHistKeys.has(key)) return { kind: "entity", table: "Offer", id: "?", status: "?", via: "slug-history" };
      return { kind: "broken", reason: "slug не найден (Offer + history)", table: "Offer" };
    }

    return { kind: "broken", reason: `неизвестная секция "/${section}/…"`, table: "-" };
  }

  const resolutions = new Map<Entry, Resolution>();
  for (const e of manifest) {
    const r = resolve(e.destination);
    resolutions.set(e, r);
    if (r.kind === "broken") {
      brokenTargets.push({ source: e.source, target: e.destination, reason: r.reason });
      brokenByTable.set(r.table, (brokenByTable.get(r.table) ?? 0) + 1);
    } else if (r.kind === "entity" && r.status !== "PUBLISHED") {
      unpublished.push({
        source: e.source,
        target: e.destination,
        reason: `${r.table} найден (via ${r.via}), но status=${r.status}`,
      });
    } else {
      okEntries.push(e);
    }
  }

  // листинговые цели с высоким трафиком — для ручного просмотра
  const categoryEntries = manifest
    .filter((e) => resolutions.get(e)?.kind === "listing")
    .sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0));

  // ---------- вывод ----------
  const report = {
    dbUrlHost: (process.env.DATABASE_URL ?? "").replace(/\/\/[^@]*@/, "//***@"),
    total: manifest.length,
    ok: okEntries.length,
    okButUnpublished: unpublished.length,
    brokenTargets: brokenTargets.length,
    brokenByTable: Object.fromEntries(brokenByTable),
    chains: chains.length,
    duplicates: duplicates.length,
    formatErrors: formatErrors.length,
  };
  console.log("=== SUMMARY ===");
  console.log(JSON.stringify(report, null, 2));

  console.log("\n=== LISTING TARGETS (by clicks) ===");
  for (const e of categoryEntries) {
    const r = resolutions.get(e)!;
    const route = r.kind === "listing" ? r.route : "?";
    console.log(
      `${(e.clicks ?? 0).toString().padStart(6)}  ${e.type ?? "-"}  ${e.source}  →  ${e.destination}  →  ${route}`,
    );
  }

  console.log("\n=== UNPUBLISHED (entity found, not PUBLISHED) ===");
  for (const p of unpublished) console.log(`${p.source} → ${p.target} :: ${p.reason}`);

  console.log("\n=== CHAINS ===");
  for (const p of chains) console.log(`${p.source} :: ${p.reason}`);

  console.log("\n=== DUPLICATES ===");
  for (const p of duplicates) console.log(`${p.source} → ${p.target} :: ${p.reason}`);

  console.log("\n=== FORMAT ERRORS ===");
  for (const p of formatErrors) console.log(`${p.source} :: ${p.reason}`);

  // CSV: все проблемные записи (broken + unpublished + chains + duplicates + format)
  const csvRows = [["source", "target", "reason"]];
  const push = (list: Problem[], prefix: string) => {
    for (const p of list) csvRows.push([p.source, p.target, `${prefix}: ${p.reason}`]);
  };
  push(brokenTargets, "broken-target");
  push(unpublished, "unpublished");
  push(chains, "chain");
  push(duplicates, "duplicate-source");
  push(formatErrors, "format");
  const csv = csvRows
    .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
    .join("\n");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const csvPath = path.join(OUT_DIR, "redirect-map-validation.csv");
  fs.writeFileSync(csvPath, csv);
  console.log(`\nCSV written: ${csvPath} (${csvRows.length - 1} rows)`);

  // формат-замечания и unpublished — предупреждения; остальное — ошибка
  if (brokenTargets.length || chains.length || duplicates.length) {
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
