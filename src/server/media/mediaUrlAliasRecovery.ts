import { buildMediaFilePublicUrl } from "@/lib/media/mediaUrlBuilder";
import { normalizeMediaAliasPath } from "@/server/media/mediaUrlAlias";

export type AliasRecoveryInputRow = {
  mediaId?: string;
  oldUrl?: string;
  oldFilename?: string;
  action?: string;
};

export type AliasRecoveryAsset = { id: string; publicUrl: string | null };
export type ExistingAlias = { mediaId: string; legacyPath: string };

export type AliasRecoveryPlanRow = {
  mediaId: string | null;
  legacyPath: string | null;
  currentUrl: string | null;
  action: "create" | "already-exists" | "duplicate" | "conflict" | "missing-media-asset" | "invalid-legacy-path" | "unresolved";
  reason: string;
};

export function buildAliasRecoveryPlan(input: {
  rows: AliasRecoveryInputRow[];
  assets: AliasRecoveryAsset[];
  aliases: ExistingAlias[];
}): AliasRecoveryPlanRow[] {
  const assets = new Map(input.assets.map((asset) => [asset.id, asset]));
  const aliases = new Map(input.aliases.map((alias) => [alias.legacyPath, alias]));
  const seen = new Set<string>();
  return input.rows.map((row) => {
    const mediaId = row.mediaId?.trim() || null;
    const rawLegacy = row.oldUrl ?? (row.oldFilename ? buildMediaFilePublicUrl(row.oldFilename) : null);
    const legacyPath = rawLegacy ? normalizeMediaAliasPath(rawLegacy) : null;
    const asset = mediaId ? assets.get(mediaId) : null;
    const base = { mediaId, legacyPath, currentUrl: asset?.publicUrl ?? null };
    if (!mediaId || !rawLegacy) return { ...base, action: "unresolved", reason: "missing-report-mapping" };
    if (!legacyPath) return { ...base, action: "invalid-legacy-path", reason: "legacy-path-rejected" };
    if (seen.has(legacyPath)) return { ...base, action: "duplicate", reason: "duplicate-input-legacy-path" };
    seen.add(legacyPath);
    if (!asset?.publicUrl) return { ...base, action: "missing-media-asset", reason: "current-media-asset-not-found" };
    const existing = aliases.get(legacyPath);
    if (existing?.mediaId === mediaId) return { ...base, action: "already-exists", reason: "alias-already-points-to-media" };
    if (existing) return { ...base, action: "conflict", reason: `legacy-path-owned-by:${existing.mediaId}` };
    return { ...base, action: "create", reason: "recover-from-canonical-apply-report" };
  });
}

export function countAliasRecoveryPlan(rows: AliasRecoveryPlanRow[]) {
  return {
    aliasesToCreate: rows.filter((row) => row.action === "create").length,
    alreadyExists: rows.filter((row) => row.action === "already-exists").length,
    duplicates: rows.filter((row) => row.action === "duplicate").length,
    conflicts: rows.filter((row) => row.action === "conflict").length,
    missingMediaAsset: rows.filter((row) => row.action === "missing-media-asset").length,
    invalidLegacyPath: rows.filter((row) => row.action === "invalid-legacy-path").length,
    unresolved: rows.filter((row) => row.action === "unresolved").length,
    errors: 0,
  };
}
