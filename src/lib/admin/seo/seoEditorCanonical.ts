import type { SeoPageEntityDiagnostics } from "@/lib/admin/seo/domain/types";

const DEFAULT_PUBLIC_BASE = "https://mamago.by";

/** База для абсолютных URL (совпадает с NEXT_PUBLIC_APP_URL на клиенте/сервере). */
export function resolveSeoPublicBase(): string {
  const raw =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL?.trim()) || "";
  return raw.replace(/\/$/, "") || DEFAULT_PUBLIC_BASE;
}

function normalizeForCompare(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "") || "/";
    return `${u.origin.toLowerCase()}${path}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Последний сегмент пути (URL или path). */
export function lastPathSegmentFromUrl(pathOrUrl: string): string {
  const s = pathOrUrl.trim();
  let pathOnly = s;
  try {
    if (s.startsWith("http://") || s.startsWith("https://")) {
      pathOnly = new URL(s).pathname;
    }
  } catch {
    /* keep pathOnly */
  }
  const parts = pathOnly.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function toAbsoluteUrl(raw: string, publicBase: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  const base = publicBase.replace(/\/$/, "") || DEFAULT_PUBLIC_BASE;
  const path = t.startsWith("/") ? t : `/${t}`;
  return `${base}${path}`;
}

export type SeoEditorCanonicalLive = {
  /** Полный URL, который получается из поля canonical или из public URL */
  effectiveCanonicalAbsolute: string | null;
  canonicalSource: "fallback from public URL" | "custom override";
  canonicalMatchesPublicUrl: "yes" | "no";
  /** Есть slug в БД, но в effective последний сегмент = entity id */
  canonicalUsesIdInsteadOfSlug: boolean;
  /** Последний сегмент effective = slug сущности (не id) */
  canonicalIsSlugBased: boolean;
  /** Абсолютный public URL страницы (как в диагностике) */
  publicUrlAbsolute: string | null;
};

/**
 * Effective canonical и проверки для SEO-редактора (учитывает черновик поля canonical).
 */
export function computeSeoEditorCanonicalLive(
  d: SeoPageEntityDiagnostics,
  seoCanonicalDraft: string,
  publicBase: string,
): SeoEditorCanonicalLive {
  const base = publicBase.replace(/\/$/, "") || DEFAULT_PUBLIC_BASE;
  const publicUrlAbsolute =
    d.absolutePublicUrl ??
    (d.publicPath ? `${base}${d.publicPath.startsWith("/") ? d.publicPath : `/${d.publicPath}`}` : null);

  const seoTrim = seoCanonicalDraft.trim();
  let effectiveCanonicalAbsolute: string | null;
  let canonicalSource: SeoEditorCanonicalLive["canonicalSource"];

  if (seoTrim) {
    effectiveCanonicalAbsolute = toAbsoluteUrl(seoTrim, base);
    canonicalSource = "custom override";
  } else {
    effectiveCanonicalAbsolute = publicUrlAbsolute;
    canonicalSource = "fallback from public URL";
  }

  let canonicalMatchesPublicUrl: "yes" | "no" = "no";
  if (effectiveCanonicalAbsolute && publicUrlAbsolute) {
    canonicalMatchesPublicUrl =
      normalizeForCompare(effectiveCanonicalAbsolute) === normalizeForCompare(publicUrlAbsolute)
        ? "yes"
        : "no";
  }

  const slugPresent = !!d.slug?.trim();
  const effectiveSeg = effectiveCanonicalAbsolute
    ? lastPathSegmentFromUrl(effectiveCanonicalAbsolute)
    : "";
  const canonicalUsesIdInsteadOfSlug =
    slugPresent && !!effectiveSeg && effectiveSeg === d.entityId;

  const slugT = d.slug?.trim() ?? "";
  const canonicalIsSlugBased =
    !!slugT &&
    !!effectiveSeg &&
    effectiveSeg === slugT &&
    effectiveSeg !== d.entityId;

  return {
    effectiveCanonicalAbsolute,
    canonicalSource,
    canonicalMatchesPublicUrl,
    canonicalUsesIdInsteadOfSlug,
    canonicalIsSlugBased,
    publicUrlAbsolute,
  };
}
