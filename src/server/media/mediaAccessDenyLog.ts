/**
 * Dev-only structured deny logging for GET /api/media/file/* (no secrets).
 */
export type MediaAccessDenyPayload = {
  requestedPath: string;
  requestedFilename: string;
  fileExists: boolean;
  storageAbsolutePath: string | null;
  mediaFound: boolean;
  mediaId: string | null;
  mediaStatus: string | null;
  mediaDeleted: boolean;
  mediaHasWizardSession: boolean;
  placeFound: boolean;
  placeId: string | null;
  placeStatus: string | null;
  legacyUrlMatched: boolean;
  mediaUsageMatched: boolean;
  logoImageIdMatched: boolean;
  coverImageIdMatched: boolean;
  businessAccess: boolean | null;
  denyReason: string;
};

export function logMediaAccessDeny(payload: MediaAccessDenyPayload): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  console.warn(`[media-access-deny] ${JSON.stringify(payload)}`);
}
