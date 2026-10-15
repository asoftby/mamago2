import { createHmac, timingSafeEqual } from "node:crypto";

export const TELEGRAM_WEBAPP_MAX_AGE_SECONDS = 5 * 60;

/** Verify signed first-party Telegram Web App data before resolving a mamaGo user. */
export function verifyTelegramWebAppInitData(
  raw: string,
  botToken: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): { telegramUserId: string } | null {
  if (!botToken || !raw || raw.length > 8192) return null;
  const params = new URLSearchParams(raw);
  const seen = new Set<string>();
  for (const key of params.keys()) {
    if (seen.has(key)) return null;
    seen.add(key);
  }

  const hash = params.get("hash");
  const timestamp = params.get("auth_date");
  const userRaw = params.get("user");
  if (!hash || !/^[a-f0-9]{64}$/iu.test(hash) || !timestamp || !/^\d{1,12}$/u.test(timestamp) || !userRaw) {
    return null;
  }

  const authDate = Number(timestamp);
  if (
    !Number.isSafeInteger(authDate) ||
    authDate > nowSeconds + 60 ||
    nowSeconds - authDate > TELEGRAM_WEBAPP_MAX_AGE_SECONDS
  ) return null;

  const entries = [...params.entries()];
  const checkSignature = (excludeSignature: boolean) => {
    const dataCheck = entries
      .filter(([key]) => key !== "hash" && (!excludeSignature || key !== "signature"))
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
    const expected = createHmac("sha256", secret).update(dataCheck).digest();
    return timingSafeEqual(expected, Buffer.from(hash, "hex"));
  };

  // Signature is an optional newer Telegram Ed25519 field. Telegram clients
  // differ as to whether it is included in first-party HMAC data-check strings.
  if (!checkSignature(false) && !(params.has("signature") && checkSignature(true))) return null;

  let parsedUser: unknown;
  try {
    parsedUser = JSON.parse(userRaw);
  } catch {
    return null;
  }
  if (!parsedUser || typeof parsedUser !== "object" || !("id" in parsedUser)) return null;
  const id = (parsedUser as { id: unknown }).id;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) return null;
  return { telegramUserId: String(id) };
}
