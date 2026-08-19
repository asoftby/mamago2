/**
 * Shared classification engine for scripts/data/wp-redirect-map.json —
 * single source of truth reused by both `scripts/validate-redirect-map.ts`
 * (CLI diagnostic) and the admin redirect center
 * (`src/lib/admin/seo/data/seoAdminData.ts`), so the two never drift.
 *
 * Resolves each manifest row's destination against the live DB (same rules
 * as the public route contracts: Activity/Article/Place/Offer direct or
 * via slug history, City hubs/listings) and classifies it into one
 * disposition: EXACT_REDIRECT / VALID_HUB_REMAP / P1_START_OR_CONTAINS /
 * INVALID_TARGET / COLLISION / CHAIN / LOOP. See
 * docs/migration/seo/redirect-audit-summary.md for the full taxonomy
 * definitions and evidence.
 */
import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

export interface RedirectManifestEntry {
  source: string;
  destination: string;
  permanent: boolean;
  type?: string;
  clicks?: number;
  confidence?: string;
}

export type RedirectDisposition =
  | "EXACT_REDIRECT"
  | "VALID_HUB_REMAP"
  | "P1_START_OR_CONTAINS"
  | "INVALID_TARGET"
  | "COLLISION"
  | "CHAIN"
  | "LOOP";

export interface Problem {
  source: string;
  target: string;
  reason: string;
}

export interface ClassifiedRedirectEntry {
  source: string;
  destination: string;
  type: string;
  clicks: number;
  permanent: boolean;
  disposition: RedirectDisposition;
  resolvedTable: string | null;
  resolvedStatus: string | null;
  reason: string | null;
}

export interface RedirectManifestClassification {
  total: number;
  entries: ClassifiedRedirectEntry[];
  counts: Record<RedirectDisposition, number>;
  formatErrors: Problem[];
  duplicates: Problem[];
  chains: Problem[];
  brokenTargets: Problem[];
  unpublished: Problem[];
  brokenByTable: Record<string, number>;
  rootRouteCollisions: Array<{ source: string; destination: string }>;
}

const DEFAULT_MANIFEST_PATH = path.join(process.cwd(), "scripts/data/wp-redirect-map.json");

export function loadWpRedirectManifestEntries(
  manifestPath: string = DEFAULT_MANIFEST_PATH,
): RedirectManifestEntry[] {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function decodeSafe(s: string): { ok: boolean; decoded: string } {
  try {
    return { ok: true, decoded: decodeURIComponent(s) };
  } catch {
    return { ok: false, decoded: s };
  }
}

// Валидный сегмент legacy-WP source: latin/digits/-/_/. или валидный percent-encoding
const SEG_RE = /^(?:[a-z0-9._~-]|%[0-9a-fA-F]{2})+$/;

const CITY_LISTING_SECTIONS = new Set(["events", "classes", "birthday", "places", "blog", "offers", "routes"]);

// event-category/place-category/place are precise 1:1 taxonomy→hub mappings;
// age/specialists/scenarios/hb-programs/uslugi/master-classes-fest/age-events
// are loose best-effort category remaps (staff pages, seasonal campaigns,
// service pages) — same destination-is-live outcome, lower content fidelity.
const HUB_REMAP_TYPES = new Set(["event-category", "place-category", "place"]);

export const KNOWN_ROOT_SEGMENTS_FOR_COLLISION_CHECK = new Set([
  "account", "actions", "activate", "admin", "api", "auth", "blog", "business",
  "business-entry", "editor", "forgot-password", "ideas", "identity", "invite",
  "legal", "login", "me", "n", "notifications", "offers", "p", "page", "places",
  "preview", "profile", "profile-entry", "register", "reset-password", "routes",
  "search", "settings", "u", "ui-lab", "ui-lab-admin", "ui-test",
]);

type Resolution =
  | { kind: "entity"; table: string; id: string; status: string; via: "direct" | "slug-history"; title?: string | null }
  | { kind: "listing"; route: string }
  | { kind: "broken"; reason: string; table: string };

export async function classifyRedirectManifest(
  prisma: PrismaClient,
  manifest: RedirectManifestEntry[],
): Promise<RedirectManifestClassification> {
  // ---------- справочные данные из БД ----------
  const cities = await prisma.city.findMany({ select: { id: true, slug: true } });
  const cityBySlug = new Map(cities.map((c) => [c.slug.toLowerCase(), c.id]));

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
  const actHistByKey = new Map<string, string>();
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
  const brokenByTable = new Map<string, number>();

  // формат source
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

  // дубли source (с учётом декодирования и нормализации)
  const normalize = (p: string) => decodeSafe(p).decoded.toLowerCase().replace(/\/+$/, "");
  const bySource = new Map<string, RedirectManifestEntry[]>();
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

  // цепочки/циклы: destination встречается как source другой записи
  const sourceSet = new Map<string, string>();
  for (const e of manifest) sourceSet.set(normalize(e.source), e.destination);
  for (const e of manifest) {
    const destNorm = normalize(e.destination.split("?")[0]);
    const srcNorm = normalize(e.source);
    if (destNorm === srcNorm) {
      chains.push({ source: e.source, target: e.destination, reason: "self-redirect (source == target)" });
      continue;
    }
    if (sourceSet.has(destNorm)) {
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

  const resolutions = new Map<RedirectManifestEntry, Resolution>();
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
    }
  }

  // ---------- disposition classification ----------
  const collisionSources = new Set(duplicates.map((d) => d.source));
  const chainSources = new Set(chains.map((c) => c.source));
  const loopSources = new Set(chains.filter((c) => c.reason.includes("ЦИКЛ")).map((c) => c.source));

  function classify(e: RedirectManifestEntry): {
    disposition: RedirectDisposition;
    resolvedTable: string | null;
    resolvedStatus: string | null;
    reason: string | null;
  } {
    if (collisionSources.has(e.source)) return { disposition: "COLLISION", resolvedTable: null, resolvedStatus: null, reason: "duplicate source" };
    if (loopSources.has(e.source)) return { disposition: "LOOP", resolvedTable: null, resolvedStatus: null, reason: "redirect loop" };
    if (chainSources.has(e.source)) return { disposition: "CHAIN", resolvedTable: null, resolvedStatus: null, reason: "redirect chain" };
    const r = resolutions.get(e)!;
    if (r.kind === "broken") return { disposition: "INVALID_TARGET", resolvedTable: r.table, resolvedStatus: null, reason: r.reason };
    if (r.kind === "entity") {
      return {
        disposition: r.status === "PUBLISHED" ? "EXACT_REDIRECT" : "INVALID_TARGET",
        resolvedTable: r.table,
        resolvedStatus: r.status,
        reason: r.status === "PUBLISHED" ? null : `status=${r.status}`,
      };
    }
    // kind === "listing"
    const disposition: RedirectDisposition = HUB_REMAP_TYPES.has(e.type ?? "") ? "VALID_HUB_REMAP" : "P1_START_OR_CONTAINS";
    return { disposition, resolvedTable: "City", resolvedStatus: null, reason: r.route };
  }

  const counts: Record<RedirectDisposition, number> = {
    EXACT_REDIRECT: 0,
    VALID_HUB_REMAP: 0,
    P1_START_OR_CONTAINS: 0,
    INVALID_TARGET: 0,
    COLLISION: 0,
    CHAIN: 0,
    LOOP: 0,
  };
  const entries: ClassifiedRedirectEntry[] = manifest.map((e) => {
    const c = classify(e);
    counts[c.disposition]++;
    return {
      source: e.source,
      destination: e.destination,
      type: e.type ?? "",
      clicks: e.clicks ?? 0,
      permanent: e.permanent,
      disposition: c.disposition,
      resolvedTable: c.resolvedTable,
      resolvedStatus: c.resolvedStatus,
      reason: c.reason,
    };
  });

  const rootRouteCollisions = manifest
    .filter((e) => {
      const segs = e.source.split("/").filter(Boolean);
      return segs.length === 1 && KNOWN_ROOT_SEGMENTS_FOR_COLLISION_CHECK.has(segs[0].toLowerCase());
    })
    .map((e) => ({ source: e.source, destination: e.destination }));

  return {
    total: manifest.length,
    entries,
    counts,
    formatErrors,
    duplicates,
    chains,
    brokenTargets,
    unpublished,
    brokenByTable: Object.fromEntries(brokenByTable),
    rootRouteCollisions,
  };
}
