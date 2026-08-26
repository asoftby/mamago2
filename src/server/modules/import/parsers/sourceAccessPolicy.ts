import { AsyncLocalStorage } from "node:async_hooks";

import type { ImportSource } from "@prisma/client";

export interface RobotsRule {
  allow: boolean;
  pattern: string;
}

export interface ParsedRobotsPolicy {
  rules: RobotsRule[];
  crawlDelayMs: number | null;
}

export interface SourceAccessContext {
  sourceSlug: string;
  parserKey: string;
  sourceHost: string;
  sourceOrigin: string;
  robotsUrl: string;
  robotsPolicy: ParsedRobotsPolicy;
  minRequestIntervalMs: number;
  cacheTtlMs: number;
}

export interface SourceFetchSettings {
  minRequestIntervalMs: number;
  cacheTtlMs: number;
}

type RobotsFetchResult = {
  text: string;
  status: number;
};

type RobotsFetcher = (url: string) => Promise<RobotsFetchResult>;

type ParserSourcePolicy = {
  fallbackBaseUrl?: string;
  minRequestIntervalMs?: number;
  cacheTtlMs?: number;
};

const DEFAULT_MIN_REQUEST_INTERVAL_MS = 500;
const DEFAULT_CACHE_TTL_MS = 2 * 60_000;
const ROBOTS_POLICY_TTL_MS = 12 * 60 * 60_000;

const PARSER_SOURCE_POLICIES: Record<string, ParserSourcePolicy> = {
  "family-by-place": {
    fallbackBaseUrl: "https://family.by/spravka/",
    minRequestIntervalMs: 750,
    cacheTtlMs: 5 * 60_000,
  },
  "family-by-playcenter-place": {
    fallbackBaseUrl: "https://family.by/spravka/dosug/playcenter/",
    minRequestIntervalMs: 750,
    cacheTtlMs: 5 * 60_000,
  },
  "family-by-directory-place": {
    fallbackBaseUrl: "https://family.by/spravka/",
    minRequestIntervalMs: 750,
    cacheTtlMs: 5 * 60_000,
  },
  "family-by-afisha-event": {
    fallbackBaseUrl: "https://family.by/afisha/",
    minRequestIntervalMs: 750,
    cacheTtlMs: 5 * 60_000,
  },
};

const sourceAccessStorage = new AsyncLocalStorage<SourceAccessContext>();

const robotsPolicyCache = new Map<
  string,
  { expiresAt: number; policy: ParsedRobotsPolicy; robotsUrl: string }
>();

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function isHttpUrl(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

function stripRobotsComment(line: string): string {
  const index = line.indexOf("#");
  return (index === -1 ? line : line.slice(0, index)).trim();
}

function splitDirective(line: string): { key: string; value: string } | null {
  const index = line.indexOf(":");
  if (index === -1) return null;
  const key = line.slice(0, index).trim().toLowerCase();
  const value = line.slice(index + 1).trim();
  if (!key) return null;
  return { key, value };
}

export function parseRobotsTxt(text: string): ParsedRobotsPolicy {
  type Group = {
    agents: string[];
    rules: RobotsRule[];
    crawlDelayMs: number | null;
  };

  const groups: Group[] = [];
  let agents: string[] = [];
  let rules: RobotsRule[] = [];
  let crawlDelayMs: number | null = null;
  let hasDirectives = false;

  const commitGroup = () => {
    if (agents.length === 0) return;
    groups.push({ agents, rules, crawlDelayMs });
    agents = [];
    rules = [];
    crawlDelayMs = null;
    hasDirectives = false;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripRobotsComment(rawLine);
    if (!line) continue;

    const directive = splitDirective(line);
    if (!directive) continue;

    if (directive.key === "user-agent") {
      if (hasDirectives) commitGroup();
      if (directive.value) agents.push(directive.value.toLowerCase());
      continue;
    }

    if (agents.length === 0) continue;

    if (directive.key === "allow" || directive.key === "disallow") {
      hasDirectives = true;
      if (directive.key === "disallow" && directive.value === "") {
        continue;
      }
      if (directive.value) {
        rules.push({
          allow: directive.key === "allow",
          pattern: directive.value,
        });
      }
      continue;
    }

    if (directive.key === "crawl-delay") {
      hasDirectives = true;
      const seconds = Number.parseFloat(directive.value.replace(",", "."));
      if (Number.isFinite(seconds) && seconds >= 0) {
        crawlDelayMs = Math.ceil(seconds * 1000);
      }
    }
  }

  commitGroup();

  const wildcardGroups = groups.filter((group) => group.agents.includes("*"));
  if (wildcardGroups.length === 0) {
    return { rules: [], crawlDelayMs: null };
  }

  return {
    rules: wildcardGroups.flatMap((group) => group.rules),
    crawlDelayMs:
      wildcardGroups.reduce<number | null>((maxDelay, group) => {
        if (group.crawlDelayMs === null) return maxDelay;
        return maxDelay === null ? group.crawlDelayMs : Math.max(maxDelay, group.crawlDelayMs);
      }, null),
  };
}

function robotsPatternToRegex(pattern: string): RegExp {
  const anchoredAtEnd = pattern.endsWith("$");
  const rawBody = anchoredAtEnd ? pattern.slice(0, -1) : pattern;
  const escaped = rawBody
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}${anchoredAtEnd ? "$" : ""}`);
}

function robotsRuleSpecificity(pattern: string): number {
  return pattern.replace(/\*/g, "").replace(/\$$/, "").length;
}

export function isPathAllowedByRobots(
  policy: ParsedRobotsPolicy,
  pathnameWithSearch: string,
): boolean {
  let winningRule: RobotsRule | null = null;
  let winningSpecificity = -1;

  for (const rule of policy.rules) {
    let matches = false;
    try {
      matches = robotsPatternToRegex(rule.pattern).test(pathnameWithSearch);
    } catch {
      continue;
    }
    if (!matches) continue;

    const specificity = robotsRuleSpecificity(rule.pattern);
    if (
      specificity > winningSpecificity ||
      (specificity === winningSpecificity && rule.allow && winningRule?.allow === false)
    ) {
      winningRule = rule;
      winningSpecificity = specificity;
    }
  }

  return winningRule?.allow ?? true;
}

function nestedHttpStatus(error: unknown): number | null {
  const seen = new Set<object>();
  let current: unknown = error;

  for (let depth = 0; depth < 6 && current; depth++) {
    if (typeof current === "object") {
      if (seen.has(current as object)) break;
      seen.add(current as object);

      const record = current as Record<string, unknown>;
      for (const key of ["status", "httpStatus"] as const) {
        const value = record[key];
        if (typeof value === "number") return value;
      }
      current = record.cause;
      continue;
    }
    break;
  }

  return null;
}

function sourceBaseUrl(source: ImportSource): URL | null {
  const parserPolicy = source.parserKey ? PARSER_SOURCE_POLICIES[source.parserKey] : undefined;
  const raw = source.baseUrl?.trim() || parserPolicy?.fallbackBaseUrl;
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid ImportSource.baseUrl: ${raw}`);
  }

  if (!isHttpUrl(parsed)) {
    throw new Error(`Unsupported ImportSource URL protocol: ${parsed.protocol}`);
  }

  return parsed;
}

async function loadRobotsPolicy(
  originUrl: URL,
  fetchRobots: RobotsFetcher,
): Promise<{ policy: ParsedRobotsPolicy; robotsUrl: string }> {
  const robotsUrl = new URL("/robots.txt", originUrl).toString();
  const cacheKey = `${originUrl.protocol}//${normalizeHost(originUrl.hostname)}:${originUrl.port || "default"}`;
  const cached = robotsPolicyCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return { policy: cached.policy, robotsUrl: cached.robotsUrl };
  }

  let policy: ParsedRobotsPolicy;

  try {
    const result = await fetchRobots(robotsUrl);
    policy = result.status >= 200 && result.status < 300
      ? parseRobotsTxt(result.text)
      : { rules: [], crawlDelayMs: null };
  } catch (error) {
    const status = nestedHttpStatus(error);

    if (status === 404 || status === 410 || (status !== null && status >= 400 && status < 500 && status !== 401 && status !== 403 && status !== 429)) {
      policy = { rules: [], crawlDelayMs: null };
    } else {
      const suffix = status === null ? "network error" : `HTTP ${status}`;
      throw new Error(`Cannot verify robots.txt for ${originUrl.hostname} (${suffix})`, {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  robotsPolicyCache.set(cacheKey, {
    expiresAt: now + ROBOTS_POLICY_TTL_MS,
    policy,
    robotsUrl,
  });

  return { policy, robotsUrl };
}

export async function prepareSourceAccessContext(
  source: ImportSource,
  fetchRobots: RobotsFetcher,
): Promise<SourceAccessContext | null> {
  if (source.fetchStrategy !== "HTML_SCRAPE") return null;

  const baseUrl = sourceBaseUrl(source);
  if (!baseUrl) return null;

  const parserPolicy = source.parserKey ? PARSER_SOURCE_POLICIES[source.parserKey] : undefined;
  const { policy: robotsPolicy, robotsUrl } = await loadRobotsPolicy(baseUrl, fetchRobots);

  const basePath = `${baseUrl.pathname}${baseUrl.search}` || "/";
  if (!isPathAllowedByRobots(robotsPolicy, basePath)) {
    throw new Error(`robots.txt disallows import scope ${basePath} on ${baseUrl.hostname}`);
  }

  const configuredDelay = parserPolicy?.minRequestIntervalMs ?? DEFAULT_MIN_REQUEST_INTERVAL_MS;
  const minRequestIntervalMs = Math.max(configuredDelay, robotsPolicy.crawlDelayMs ?? 0);

  return {
    sourceSlug: source.slug,
    parserKey: source.parserKey ?? "unknown",
    sourceHost: normalizeHost(baseUrl.hostname),
    sourceOrigin: baseUrl.origin,
    robotsUrl,
    robotsPolicy,
    minRequestIntervalMs,
    cacheTtlMs: parserPolicy?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
  };
}

export async function withSourceAccessContext<T>(
  context: SourceAccessContext | null,
  task: () => Promise<T>,
): Promise<T> {
  if (!context) return task();
  return sourceAccessStorage.run(context, task);
}

export function assertSourceRequestAllowed(rawUrl: string): void {
  const context = sourceAccessStorage.getStore();
  if (!context) return;

  let candidate: URL;
  try {
    candidate = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid import request URL: ${rawUrl}`);
  }

  if (!isHttpUrl(candidate)) {
    throw new Error(`Unsupported import request protocol: ${candidate.protocol}`);
  }

  const candidateHost = normalizeHost(candidate.hostname);
  if (candidateHost !== context.sourceHost) {
    throw new Error(
      `Cross-origin HTML request blocked for source ${context.sourceSlug}: ${candidate.hostname}`,
    );
  }

  const path = `${candidate.pathname}${candidate.search}` || "/";
  if (!isPathAllowedByRobots(context.robotsPolicy, path)) {
    throw new Error(`robots.txt disallows ${path} on ${candidate.hostname}`);
  }
}

export function getActiveSourceFetchSettings(rawUrl: string): SourceFetchSettings | null {
  const context = sourceAccessStorage.getStore();
  if (!context) return null;

  let candidate: URL;
  try {
    candidate = new URL(rawUrl);
  } catch {
    return null;
  }

  if (normalizeHost(candidate.hostname) !== context.sourceHost) return null;

  return {
    minRequestIntervalMs: context.minRequestIntervalMs,
    cacheTtlMs: context.cacheTtlMs,
  };
}

export function clearSourceAccessPolicyCacheForTests(): void {
  robotsPolicyCache.clear();
}
