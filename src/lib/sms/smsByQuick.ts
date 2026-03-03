/**
 * SMS.BY sendQuickSms client
 * Simple helper that matches the working legacy project implementation
 */

interface SmsByResponse {
  sms_id?: string;
  status?: string;
  error?: string;
  message?: string;
}

/**
 * Send SMS via SMS.BY sendQuickSms endpoint
 * @param phoneE164 - Phone in E.164 format (e.g., "+375291234567")
 * @param message - SMS message text
 * @returns Response with sms_id and status
 * @throws Error with readable message if sending fails
 */
export async function smsBySendQuickSms(
  phoneE164: string,
  message: string
): Promise<SmsByResponse> {
  // Normalize phone: digits only (remove +, spaces, brackets, dashes)
  const phone = phoneE164.replace(/\D/g, "");

  // Validate inputs
  if (!phone || phone.length < 7) {
    throw new Error("Неверный формат телефона");
  }

  if (!message || message.trim().length === 0) {
    throw new Error("Сообщение не может быть пустым");
  }

  const token = process.env.SMS_BY_TOKEN;
  if (!token || token === "YOUR_TOKEN_HERE") {
    throw new Error("SMS_BY_TOKEN не настроен");
  }

  // Prepare URL-encoded body
  const body = new URLSearchParams({
    token,
    phone,
    message,
    alphaname_id: "4720",
  });

  const baseUrl = process.env.SMS_BY_BASE_URL ?? "https://app.sms.by";
  const url = `${baseUrl}/api/v1/sendQuickSms`;

  // Debug logging (development only)
  if (process.env.NODE_ENV === "development") {
    console.log("sms.by quick", { 
      phone, 
      hasToken: !!token,
      messageLength: message.length 
    });
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body,
    });

    // Read response as text first
    const responseText = await res.text();

    // Debug logging (development only)
    if (process.env.NODE_ENV === "development") {
      console.log("sms.by raw", responseText);
    }

    // Try to parse as JSON
    let data: SmsByResponse;
    try {
      data = JSON.parse(responseText);
    } catch {
      // If not JSON, treat as error
      throw new Error(
        res.ok
          ? "Неверный формат ответа от SMS.BY"
          : `Ошибка SMS.BY: ${responseText}`
      );
    }

    // Check for errors in response
    if (!res.ok || data.error) {
      const errorMessage =
        data.error || data.message || `HTTP ${res.status}: ${responseText}`;
      throw new Error(errorMessage);
    }

    // Success
    return data;
  } catch (error) {
    // Re-throw with readable message
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Не удалось отправить SMS");
  }
}
