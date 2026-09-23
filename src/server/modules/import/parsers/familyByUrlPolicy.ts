/**
 * Source-integrity policy for family.by HTML imports.
 *
 * Network-level SSRF protection is enforced centrally by fetchHtml/fetchBinary
 * (public DNS answers only, pinned socket, redirect revalidation). This policy
 * additionally prevents an editor from repointing a family.by parser at an
 * unrelated public host or a confused-host URL containing "family.by" only in
 * its path/query.
 */

const FAMILY_BY_IMPORT_HOSTS = new Set(["family.by", "www.family.by"]);

export function assertSafeFamilyByImportUrl(
  raw: string | URL,
  options: { pathPrefix?: string } = {},
): URL {
  let url: URL;
  try {
    url = raw instanceof URL ? new URL(raw.toString()) : new URL(raw.trim());
  } catch {
    throw new Error("Invalid family.by import URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("family.by import URL must use HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("family.by import URL credentials are not allowed");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/u, "");
  if (!FAMILY_BY_IMPORT_HOSTS.has(hostname)) {
    throw new Error("family.by import host is not allowed");
  }

  const pathPrefix = options.pathPrefix?.trim();
  if (pathPrefix && !url.pathname.startsWith(pathPrefix)) {
    throw new Error(`family.by import URL must stay under ${pathPrefix}`);
  }

  return url;
}
