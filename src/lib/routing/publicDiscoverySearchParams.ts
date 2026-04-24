const PUBLIC_DISCOVERY_SEARCH_PARAM_KEYS = new Set([
  "age",
  "when",
  "city",
  "persona",
  "personaId",
  "personaIds",
  "metro",
  "district",
  "nearby",
  "dateFrom",
  "dateTo",
  "from",
  "to",
  "preset",
  "intent",
]);

export function stripPublicDiscoverySearchParams(search: string): string {
  if (!search || search === "?") {
    return "";
  }

  const normalized = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(normalized);

  for (const key of PUBLIC_DISCOVERY_SEARCH_PARAM_KEYS) {
    params.delete(key);
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function stripPublicDiscoverySearchParamsFromPath(path: string): string {
  const match = /^([^?#]*)(\?[^#]*)?(#.*)?$/u.exec(path);
  const pathname = match?.[1] || "/";
  const search = stripPublicDiscoverySearchParams(match?.[2] || "");
  const hash = match?.[3] || "";
  return `${pathname}${search}${hash}`;
}
