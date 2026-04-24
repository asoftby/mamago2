const PUBLIC_DISCOVERY_PARAM_KEYS = [
  "age",
  "when",
  "preset",
  "from",
  "to",
  "dateFrom",
  "dateTo",
  "metro",
  "district",
  "nearby",
  "city",
  "persona",
  "personaId",
  "intent",
] as const;

function normalizeSearchString(search: string): string {
  if (!search) return "";
  return search.startsWith("?") ? search.slice(1) : search;
}

export function stripPublicDiscoveryParamsFromSearch(search: string): string {
  const params = new URLSearchParams(normalizeSearchString(search));

  for (const key of PUBLIC_DISCOVERY_PARAM_KEYS) {
    params.delete(key);
  }

  const next = params.toString();
  return next ? `?${next}` : "";
}

export function stripPublicDiscoveryParamsFromPath(path: string): string {
  if (!path.includes("?")) return path;
  const [pathname, searchHash] = path.split("?");
  const [search, hash = ""] = searchHash.split("#");
  const cleanedSearch = stripPublicDiscoveryParamsFromSearch(search);
  const hashSuffix = hash ? `#${hash}` : "";
  return `${pathname}${cleanedSearch}${hashSuffix}`;
}
