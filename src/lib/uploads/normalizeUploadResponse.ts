import type { UploadedMedia } from "./uploadTypes";

type UploadResponseRecord = Record<string, unknown>;

function asRecord(value: unknown): UploadResponseRecord | null {
  return value && typeof value === "object" ? (value as UploadResponseRecord) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeUploadResponse(data: unknown): UploadedMedia {
  const root = asRecord(data);
  const media = asRecord(root?.media);
  const asset = asRecord(root?.asset);
  const legacyMedia = asRecord(root?.media && !("id" in (root.media as object)) ? null : root?.media);

  const id =
    asString(media?.id) ??
    asString(asset?.id) ??
    asString(legacyMedia?.id) ??
    asString(root?.mediaId) ??
    asString(root?.id);

  const url =
    asString(media?.url) ??
    asString(media?.publicUrl) ??
    asString(asset?.url) ??
    asString(asset?.publicUrl) ??
    asString(legacyMedia?.url) ??
    asString(legacyMedia?.publicUrl) ??
    asString(root?.url) ??
    asString(root?.publicUrl);

  if (!id || !url) {
    throw new Error("Upload succeeded but response does not contain media id/url");
  }

  const mimeType =
    asString(media?.mimeType) ??
    asString(asset?.mimeType) ??
    asString(legacyMedia?.mimeType) ??
    asString(root?.mimeType) ??
    "image/webp";

  const fileName =
    asString(media?.fileName) ??
    asString(media?.filename) ??
    asString(asset?.fileName) ??
    asString(asset?.filename) ??
    asString(legacyMedia?.fileName) ??
    asString(legacyMedia?.filename) ??
    asString(root?.fileName) ??
    asString(root?.filename) ??
    id;

  return {
    id,
    url,
    mimeType,
    fileName,
    width:
      asNumber(media?.width) ??
      asNumber(asset?.width) ??
      asNumber(legacyMedia?.width) ??
      asNumber(root?.width),
    height:
      asNumber(media?.height) ??
      asNumber(asset?.height) ??
      asNumber(legacyMedia?.height) ??
      asNumber(root?.height),
    size:
      asNumber(media?.size) ??
      asNumber(media?.sizeBytes) ??
      asNumber(asset?.size) ??
      asNumber(asset?.sizeBytes) ??
      asNumber(legacyMedia?.size) ??
      asNumber(legacyMedia?.sizeBytes) ??
      asNumber(root?.size) ??
      asNumber(root?.sizeBytes),
    status:
      asString(media?.status) ??
      asString(asset?.status) ??
      asString(legacyMedia?.status) ??
      asString(root?.status) ??
      undefined,
  };
}
