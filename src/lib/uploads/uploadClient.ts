import { normalizeUploadResponse } from "./normalizeUploadResponse";
import type { UploadErrorResponse, UploadedMedia } from "./uploadTypes";

type UploadMediaFileOptions = {
  endpoint?: "/api/upload" | "/api/upload/wizard" | string;
  wizardSessionId?: string;
  draftEntityId?: string;
  draftEntityType?: string;
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
