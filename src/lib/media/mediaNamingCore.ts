export type MediaFilenameContext =
  | { type: "ARTICLE"; id: string; title: string; slug: string; sequence: number }
  | { type: "CONTEXTLESS"; createdAt?: Date; unique?: string };

export function safeMediaStem(value: string): string {
  return slugify(value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")) || "media";
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

export function timestampMediaStem(date = new Date(), unique = crypto.randomUUID().slice(0, 8)): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}-${safeMediaStem(unique).slice(0, 8)}`;
}

export function buildMediaStem(context: MediaFilenameContext): string {
  return context.type === "CONTEXTLESS"
    ? timestampMediaStem(context.createdAt, context.unique)
    : `${safeMediaStem(context.slug)}-${pad(context.sequence)}`;
}

export function buildMasterFilename(stem: string): string {
  return `${safeMediaStem(stem)}.webp`;
}

export function buildResponsiveFilename(stem: string, size: string): string {
  return `${safeMediaStem(stem)}-${safeMediaStem(size)}.webp`;
}

export function buildEntityMediaFilename(input: {
  entityType: "ARTICLE" | "EVENT" | "PLACE" | "OFFER" | "ROUTE";
  slug: string | null;
  title: string;
  field: string;
  sequence: number;
}): string {
  const stem = safeMediaStem(input.slug || input.title);
  return input.entityType === "PLACE" && input.field === "logo"
    ? buildMasterFilename(`${stem}-logo`)
    : buildMasterFilename(`${stem}-${String(input.sequence).padStart(2, "0")}`);
}

export function canRenamePublishedMedia(input: { status: string; explicitMigration?: boolean }): boolean {
  return input.status !== "PUBLISHED" || input.explicitMigration === true;
}

export function canonicalOwnershipGate(input: { branding: boolean; entityCount: number }): "skip-branding" | "skip-shared" | "skip-orphan" | "owned" {
  if (input.branding) return "skip-branding";
  if (input.entityCount > 1) return "skip-shared";
  if (input.entityCount === 0) return "skip-orphan";
  return "owned";
}
import { slugify } from "@/lib/slug/slugUtils";
