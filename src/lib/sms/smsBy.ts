/**
 * sms.by sendQuickSms client. The working integration uses exactly token,
 * phone and message (form-encoded), with the provider's default sender.
 * Do not reintroduce alphaname_id: it caused sender-name rejection.
 */
import { parseSmsByResponse, SmsByDeliveryError } from "./smsByResponse";
import type { SmsByResponse } from "./smsByResponse";
import { reportSmsByFailure } from "@/server/ops/reportSmsByFailure";

export type { SmsByResponse } from "./smsByResponse";

interface SendQuickSmsParams {
  phoneDigits: string;
  message: string;
}

export async function sendQuickSms({
  phoneDigits,
  message,
}: SendQuickSmsParams): Promise<SmsByResponse> {
  if (!/^\\d{7,15}$/.test(phoneDigits)) {
    throw new Error("Неверный формат телефона");
  }
  if (!message?.trim()) {
    throw new Error("Сообщение не может быть пустым");
  }

  const token = process.env.SMS_BY_TOKEN;
  let failure: SmsByDeliveryError | null = null;

  try {
    if (!token || ["YOUR_TOKEN_HERE", "your_sms_by_token_here"].includes(token)) {
      throw new SmsByDeliveryError("NOT_CONFIGURED");
    }

    const baseUrl = process.env.SMS_BY_BASE_URL ?? "https://app.sms.by";
    const url = `${baseUrl.replace(/\\/$/, "")}/api/v1/sendQuickSms`;
    const body = new URLSearchParams({ token, phone: phoneDigits, message });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const responseText = await res.text();
    const result = parseSmsByResponse(res.status, responseText);
    console.info("[sms-by] provider accepted message", { status: result.status ?? null });
    return result;
  } catch (error) {
    failure = error instanceof SmsByDeliveryError
      ? error
      : new SmsByDeliveryError("NETWORK_ERROR");
    await reportSmsByFailure({
      reason: failure.reason,
      httpStatus: failure.httpStatus,
    });
    throw failure;
  }
}
