/**
 * Stateless sms.by sendQuickSms response validation.
 * HTTP 200 alone is not proof of provider acceptance.
 * Keep raw provider messages, OTP and phone numbers out of errors/logs.
 */
export type SmsByFailureReason =
  | "NOT_CONFIGURED"
  | "NETWORK_ERROR"
  | "HTTP_ERROR"
  | "PROVIDER_REJECTED"
  | "INVALID_RESPONSE";

export class SmsByDeliveryError extends Error {
  constructor(
    readonly reason: SmsByFailureReason,
    readonly httpStatus?: number,
  ) {
    super("Не удалось отправить SMS. Попробуйте ещё раз или обратитесь в поддержку.");
    this.name = "SmsByDeliveryError";
  }
}

export interface SmsByResponse {
  sms_id?: number | string;
  message_id?: number | string;
  status?: string;
  parts?: number;
  balance?: number;
  currency?: string;
  error?: unknown;
  message?: unknown;
}

const ACCEPTED_STATUSES = new Set([
  "NEW", "QUEUED", "ACCEPTED", "SENT", "DELIVERED", "SUCCESS", "OK",
]);

export function parseSmsByResponse(
  httpStatus: number,
  responseText: string,
): SmsByResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new SmsByDeliveryError(
      httpStatus >= 200 && httpStatus < 300 ? "INVALID_RESPONSE" : "HTTP_ERROR",
      httpStatus,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SmsByDeliveryError("INVALID_RESPONSE", httpStatus);
  }
  const data = parsed as SmsByResponse;
  if (httpStatus < 200 || httpStatus >= 300) {
    throw new SmsByDeliveryError("HTTP_ERROR", httpStatus);
  }
  const status = typeof data.status === "string" ? data.status.toUpperCase() : "";
  const providerError = data.error != null && data.error !== false && data.error !== "";
  if (providerError || !ACCEPTED_STATUSES.has(status)) {
    throw new SmsByDeliveryError("PROVIDER_REJECTED", httpStatus);
  }
  const messageId = data.sms_id ?? data.message_id;
  if (
    (typeof messageId !== "string" && typeof messageId !== "number") ||
    String(messageId).trim().length === 0
  ) {
    throw new SmsByDeliveryError("INVALID_RESPONSE", httpStatus);
  }
  return data;
}
