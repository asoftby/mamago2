/**
 * Redirect manifest loading + validation for the WordPress → mamaGo 2.0 SEO migration.
 *
 * Consumed by next.config.ts at build time: manifest.csv (project root, generated
 * by `pnpm build-migration-manifest` against a DB with the imported WP content)
 * is turned into Next.js redirect rules.
 *
 * Fail-loud contract: when `require` is set (REQUIRE_REDIRECT_MANIFEST=1 in the
 * production image build), a missing/underfilled/invalid manifest ABORTS the build.
 * Without the flag (local dev), problems are logged and the build proceeds —
 * matching the historical dev behaviour.
 *
 * No path aliases and no non-node imports here: this module is imported from
 * next.config.ts, which is compiled outside the app's alias resolution.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface RedirectRule {
  source: string;
  destination: string;
  permanent: boolean;
}

export interface ManifestValidationIssue {
  /** Machine-readable kind, useful in tests. */
  kind:
    | "missing-file"
    | "below-threshold"
    | "bad-path"
    | "trailing-slash"
    | "duplicate-source"
    | "self-redirect"
    | "cycle"
    | "unknown-destination-section";
  message: string;
}

export interface AllowedSections {
  /** First-segment routes that exist at the site root, e.g. "blog", "places". */
  rootSections: string[];
  /** Sections that exist under /[city]/…, e.g. "events", "blog". */
  citySections: string[];
}

export interface LoadRedirectManifestOptions {
  manifestPath: string;
  /** Fail-loud mode: throw instead of warn+skip. */
  require: boolean;
  /** Minimum number of redirect rows (wp_journal + slug_history + wp_map; canonical rows excluded). */
  minRows: number;
  allowedSections: AllowedSections;
  /** Injectable for tests; defaults to console.warn. */
  warn?: (message: string) => void;
}

export interface LoadRedirectManifestResult {
  rules: RedirectRule[];
  issues: ManifestValidationIssue[];
  /** Redirect rows seen in the file before validation dropped any. */
  totalRedirectRows: number;
}

/** Minimal RFC-4180 CSV line splitter (handles quoted fields with embedded commas). */
export function csvSplitLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === '"' && line[j + 1] === '"') { j += 2; continue; }
        if (line[j] === '"') break;
        j++;
      }
      fields.push(line.slice(i + 1, j).replace(/""/g, '"'));
      i = j + 2; // skip closing quote + comma
    } else {
      const end = line.indexOf(",", i);
      if (end === -1) { fields.push(line.slice(i)); break; }
      fields.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return fields;
}

/**
 * Derives the allowed destination sections from the actual app router tree,
 * so the validator never drifts from real routing.
 *
 * - root sections: directories in src/app/(public) (minus route groups,
 *   dynamic segments and files)
 * - city sections: directories in src/app/(public)/[city]
 */
export function deriveAllowedSectionsFromAppDir(appDir: string): AllowedSections {
  const listRouteDirs = (dir: string): string[] => {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith("(") && !name.startsWith("[") && !name.startsWith("_"));
  };

  const publicDir = join(appDir, "(public)");
  return {
    rootSections: listRouteDirs(publicDir),
    citySections: listRouteDirs(join(publicDir, "[city]")),
  };
}

const CITY_SLUG_RE = /^[a-z0-9-]+$/;

/**
 * A destination must land on the new URL scheme:
 *   /{rootSection}/…            — known root route (e.g. /blog/slug)
 *   /{city}                     — city hub
 *   /{city}/{citySection}/…     — city-first route (e.g. /minsk/blog/slug)
 */
function isDestinationOnNewScheme(destination: string, allowed: AllowedSections): boolean {
  const segments = destination.split("/").filter(Boolean);
  if (segments.length === 0) return true; // "/" — homepage is always valid

  const [first, second] = segments;
  if (allowed.rootSections.includes(first)) return true;

  if (!CITY_SLUG_RE.test(first)) return false;
  if (segments.length === 1) return true; // city hub /{city}
  return allowed.citySections.includes(second);
}

function toPath(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    // Manifest values are absolute URLs; accept already-relative paths as-is.
    return url.startsWith("/") ? url : null;
  }
}

/**
 * Loads manifest.csv and converts wp_journal + slug_history + wp_map rows
 * into Next.js redirect rules with full validation.
 *
 * In `require` mode any issue (including a missing file or too few rows)
 * throws. Otherwise issues are reported via `warn` and offending rows are
 * dropped, so dev builds keep working with whatever is valid.
 */
export function loadRedirectManifest(
  options: LoadRedirectManifestOptions,
): LoadRedirectManifestResult {
  const warn = options.warn ?? ((message: string) => console.warn(message));
  const issues: ManifestValidationIssue[] = [];

  const finish = (rules: RedirectRule[], totalRedirectRows: number): LoadRedirectManifestResult => {
    if (totalRedirectRows < options.minRows) {
      issues.push({
        kind: "below-threshold",
        message:
          `[redirect-manifest] Only ${totalRedirectRows} redirect rows in ${options.manifestPath} ` +
          `(minimum ${options.minRows}). Regenerate with \`pnpm build-migration-manifest\` against ` +
          `the production DB, or adjust REDIRECT_MANIFEST_MIN_ROWS.`,
      });
    }

    if (options.require && issues.length > 0) {
      throw new Error(
        `[redirect-manifest] Manifest validation failed (${issues.length} issue(s)):\n` +
          issues.map((issue) => `  - ${issue.message}`).join("\n"),
      );
    }
    for (const issue of issues) warn(issue.message);
    return { rules, issues, totalRedirectRows };
  };

  if (!existsSync(options.manifestPath)) {
    issues.push({
      kind: "missing-file",
      message:
        `[redirect-manifest] ${options.manifestPath} not found. ` +
        `Run \`pnpm build-migration-manifest\` to generate it.`,
    });
    return finish([], 0);
  }

  const lines = readFileSync(options.manifestPath, "utf8").trim().split("\n");
  const [header, ...rows] = lines;
  const cols = header.split(",");
  const idx = (name: string) => cols.indexOf(name);

  interface Candidate {
    source: string;
    destination: string;
    line: number;
  }
  const candidates: Candidate[] = [];
  let totalRedirectRows = 0;

  rows.forEach((raw, rowIndex) => {
    const cells = csvSplitLine(raw);
    const ruleType = cells[idx("rule_type")] ?? "";
    const oldUrl = cells[idx("old_url")] ?? "";
    const newUrl = cells[idx("new_url")] ?? "";

    // canonical rows carry no old_url — they are targets, not redirects.
    if (!["wp_journal", "slug_history", "wp_map"].includes(ruleType)) return;
    if (!oldUrl || !newUrl) return;

    totalRedirectRows += 1;
    const line = rowIndex + 2; // 1-based + header

    const source = toPath(oldUrl);
    const destination = toPath(newUrl);
    if (!source || !destination) {
      issues.push({
        kind: "bad-path",
        message: `[redirect-manifest] line ${line}: cannot parse path from "${oldUrl}" → "${newUrl}"`,
      });
      return;
    }

    if (destination.endsWith("/") && destination !== "/") {
      issues.push({
        kind: "trailing-slash",
        message: `[redirect-manifest] line ${line}: destination has trailing slash: ${destination}`,
      });
      return;
    }

    if (source === destination) {
      issues.push({
        kind: "self-redirect",
        message: `[redirect-manifest] line ${line}: source equals destination: ${source}`,
      });
      return;
    }

    if (!isDestinationOnNewScheme(destination, options.allowedSections)) {
      issues.push({
        kind: "unknown-destination-section",
        message:
          `[redirect-manifest] line ${line}: destination "${destination}" does not match ` +
          `the new URL scheme (known root/city sections derived from src/app)`,
      });
      return;
    }

    candidates.push({ source, destination, line });
  });

  // Duplicate sources: identical pairs are deduped silently; conflicting targets are an error.
  const bySource = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const existing = bySource.get(candidate.source);
    if (!existing) {
      bySource.set(candidate.source, candidate);
      continue;
    }
    if (existing.destination !== candidate.destination) {
      issues.push({
        kind: "duplicate-source",
        message:
          `[redirect-manifest] lines ${existing.line} and ${candidate.line}: duplicate source ` +
          `"${candidate.source}" with different destinations ` +
          `("${existing.destination}" vs "${candidate.destination}")`,
      });
      bySource.delete(candidate.source);
    }
    // identical duplicate — keep the first, drop the copy
  }

  // Cycle detection: follow destination chains within the manifest itself.
  const destinationOf = new Map<string, string>();
  for (const [source, candidate] of bySource) destinationOf.set(source, candidate.destination);

  const inCycle = new Set<string>();
  for (const [start] of destinationOf) {
    if (inCycle.has(start)) continue;
    const visited: string[] = [start];
    let current = destinationOf.get(start);
    while (current !== undefined && visited.length <= destinationOf.size) {
      if (visited.includes(current)) {
        const cycle = [...visited.slice(visited.indexOf(current)), current];
        for (const node of cycle) inCycle.add(node);
        issues.push({
          kind: "cycle",
          message: `[redirect-manifest] redirect cycle: ${cycle.join(" → ")}`,
        });
        break;
      }
      visited.push(current);
      current = destinationOf.get(current);
    }
  }
  for (const node of inCycle) bySource.delete(node);

  const rules: RedirectRule[] = [...bySource.values()].map((candidate) => ({
    source: candidate.source,
    destination: candidate.destination,
    // permanent: true → Next.js responds with 308. Deliberate: Google treats
    // 308 as a permanent redirect, click equity transfers same as 301.
    permanent: true,
  }));

  return finish(rules, totalRedirectRows);
}
