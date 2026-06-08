export type UploadedMedia = {
  id: string;
  url: string;
  mimeType: string;
  fileName: string;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  status?: "TEMP" | "PERSISTENT" | string;
};

export type UploadErrorCode =
  | "FILE_REQUIRED"
  | "INVALID_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "WIZARD_SESSION_REQUIRED"
  | "STORAGE_WRITE_FAILED"
  | "IMAGE_PROCESSING_FAILED"
  | "DATABASE_WRITE_FAILED"
  | "UPLOAD_FAILED";

export type UploadSuccessResponse = {
  media: UploadedMedia;
};

export type UploadErrorResponse = {
  error: UploadErrorCode | string;
  message: string;
};
