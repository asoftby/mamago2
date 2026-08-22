import { normalizeUploadResponse } from "./normalizeUploadResponse";
import type { UploadErrorResponse, UploadedMedia } from "./uploadTypes";
import type { UploadContext } from "./resolveUploadOwner";

type UploadMediaFileOptions = {
  endpoint?: "/api/upload" | "/api/upload/wizard" | string;
  wizardSessionId?: string;
  draftEntityId?: string;
  draftEntityType?: string;
  /**
   * Admin/moderator-only: attribute the upload to another user's media
   * library. The server only honors this alongside a matching
   * `uploadContext` — sending one without the other is always rejected.
   */
  ownerUserId?: string;
  uploadContext?: UploadContext;
  onProgress?: never;
};

export async function uploadMediaFile(
  file: File,
  options?: UploadMediaFileOptions,
): Promise<UploadedMedia> {
  const endpoint = options?.endpoint ?? (options?.wizardSessionId ? "/api/upload/wizard" : "/api/upload");
  const formData = new FormData();
  formData.append("file", file);

  if (options?.wizardSessionId) {
    formData.append("wizardSessionId", options.wizardSessionId);
  }
  if (options?.draftEntityId) {
    formData.append("draftEntityId", options.draftEntityId);
  }
  if (options?.draftEntityType) {
    formData.append("draftEntityType", options.draftEntityType);
  }
  if (options?.ownerUserId) {
    formData.append("ownerUserId", options.ownerUserId);
  }
  if (options?.uploadContext) {
    formData.append("uploadContext", options.uploadContext);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorPayload = payload as UploadErrorResponse | null;
    throw new Error(
      errorPayload?.message ||
        errorPayload?.error ||
        `Upload failed: HTTP ${response.status} ${response.statusText}`,
    );
  }

  return normalizeUploadResponse(payload);
}
