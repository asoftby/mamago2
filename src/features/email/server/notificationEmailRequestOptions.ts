import type { CreateEmailRequestOptions } from "resend";

// The installed Resend SDK forwards request options to fetch, including signal.
// Keep the deadline active while headers AND the response body are read.
export const NOTIFICATION_EMAIL_TIMEOUT_MS = 5_000;
export function notificationEmailRequestOptions(): CreateEmailRequestOptions & { signal: AbortSignal } {
  return { signal: AbortSignal.timeout(NOTIFICATION_EMAIL_TIMEOUT_MS) };
}
