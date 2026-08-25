import { buildMediaFilePublicUrl } from "@/lib/media/mediaUrlBuilder";
import { buildEntityMediaFilename, canonicalOwnershipGate } from "@/lib/media/mediaNamingCore";
import { auditAllMediaReferences, type AuditedReference } from "@/server/media/mediaReferenceAudit";

export type CanonicalAuditAction =
  | "rename-article" | "rename-event" | "rename-place" | "rename-offer" | "rename-route"
  | "skip-shared" | "skip-branding" | "skip-orphan" | "skip-unresolved"
  | "skip-external" | "skip-error" | "already-canonical";

function entityKey(ref: AuditedReference) {
  return `${ref.entityType}:${ref.entityId}`;
}

export async function buildCanonicalNamingDryRun() {
  const audit = await auditAllMediaReferences();
  const sequenceByMedia = new Map<string, number>();
  const grouped = new Map<string, AuditedReference[]>();
  for (const ref of audit.references) grouped.set(entityKey(ref), [...(grouped.get(entityKey(ref)) ?? []), ref]);
  for (const refs of grouped.values()) {
    const orderedIds = [...new Set(refs.sort((a, b) => a.order - b.order).map((ref) => ref.mediaId))];
    orderedIds.forEach((id, index) => sequenceByMedia.set(`${entityKey(refs[0])}:${id}`, index + 1));
  }

  const rows = audit.assets.map((asset) => {
    const refs = audit.refsByMedia.get(asset.id) ?? [];
    const entities = new Set(refs.map(entityKey));
    const first = refs.sort((a, b) => a.order - b.order)[0];
    const base = {
      mediaId: asset.id,
      currentFilename: asset.filename,
      currentUrl: asset.publicUrl,
      proposedFilename: asset.filename,
      proposedUrl: asset.publicUrl,
      usageCount: entities.size,
      entityType: first?.entityType ?? null,
      entityId: first?.entityId ?? null,
      entityTitle: first?.entityTitle ?? null,
      entitySlug: first?.entitySlug ?? null,
      field: first?.field ?? null,
    };
    const result = (action: CanonicalAuditAction, reason: string, proposedFilename = asset.filename) => ({
      ...base, proposedFilename, proposedUrl: proposedFilename === asset.filename ? asset.publicUrl : buildMediaFilePublicUrl(proposedFilename), action, reason,
    });
    const ownership = canonicalOwnershipGate({ branding: audit.brandingIds.has(asset.id), entityCount: entities.size });
    if (ownership === "skip-branding") return result("skip-branding", "branding-direct-fk");
    if (ownership === "skip-shared") return result("skip-shared", "asset-used-by-multiple-entities");
    if (ownership === "skip-orphan" || !first) return result("skip-orphan", "no-reverse-reference");
    const storage = audit.storageState.get(asset.id);
    if (storage === "external") return result("skip-external", "not-managed-runtime-storage");
    if (storage === "missing") return result("skip-unresolved", "managed-file-missing");
    if (!["ARTICLE", "EVENT", "PLACE", "OFFER", "ROUTE"].includes(first.entityType)) {
      return result("skip-unresolved", `no-canonical-policy-for-${first.entityType.toLowerCase()}`);
    }
    const seq = sequenceByMedia.get(`${entityKey(first)}:${asset.id}`) ?? 1;
    const filename = buildEntityMediaFilename({
      entityType: first.entityType as "ARTICLE" | "EVENT" | "PLACE" | "OFFER" | "ROUTE",
      slug: first.entitySlug,
      title: first.entityTitle,
      field: first.field,
      sequence: seq,
    });
    const expectedUrl = buildMediaFilePublicUrl(filename);
    if (asset.filename === filename && asset.publicUrl === expectedUrl && asset.storageKey === expectedUrl) {
      return result("already-canonical", "already-canonical", filename);
    }
    return result(`rename-${first.entityType.toLowerCase()}` as CanonicalAuditAction, "single-owner-managed", filename);
  });
  return { audit, rows };
}
