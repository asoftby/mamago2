/**
 * SMS.BY sendQuickSms client (app.sms.by API v1)
 *
 * Correct request format: POST form-encoded with alphaname_id.
 * JSON body does NOT work — returns "ошибка в буквенном имени".
 */

interface SendQuickSmsParams {
  phoneDigits: string; // Digits only, no + prefix, e.g. "375447777405"
  message: string;
}

export interface SmsByResponse {
  sms_id?: number;
  status?: string;   // "NEW" = queued successfully
  parts?: number;
  balance?: number;
  currency?: string;
  error?: string;
  message?: string;
}

export async function sendQuickSms({
  phoneDigits,
  message,
}: SendQuickSmsParams): Promise<SmsByResponse> {
  if (!phoneDigits || phoneDigits.length < 7) {
    throw new Error("Неверный формат телефона");
  }
  if (!message || message.trim().length === 0) {
    throw new Error("Сообщение не может быть пустым");
  }

  const token = process.env.SMS_BY_TOKEN;
  if (!token || token === "YOUR_TOKEN_HERE" || token === "your_sms_by_token_here") {
    throw new Error("SMS_BY_TOKEN не настроен");
  }

  const baseUrl = process.env.SMS_BY_BASE_URL ?? "https://app.sms.by";
  const url = `${baseUrl}/api/v1/sendQuickSms`;

  // IMPORTANT: must be form-encoded, not JSON.
  // JSON body causes "ошибка в буквенном имени" (alphaname error).
  const body = new URLSearchParams({
    token,
    phone: phoneDigits,
    message,
    alphaname_id: "4720",
  });

  console.log(`[smsBy] sending to ${phoneDigits.slice(0, 6)}... via ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body,
  });

  const responseText = await res.text();
  console.log(`[smsBy] response ${res.status}: ${responseText}`);

  let data: SmsByResponse;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      res.ok
        ? `SMS.BY: неверный формат ответа: ${responseText}`
        : `SMS.BY HTTP ${res.status}: ${responseText}`
    );
  }

  if (!res.ok || data.error) {
    throw new Error(data.error ?? data.message ?? `SMS.BY HTTP ${res.status}`);
  }

  return data;
}
