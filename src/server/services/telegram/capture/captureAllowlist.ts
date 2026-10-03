/**
 * Pilot flag: TELEGRAM_CAPTURE_USER_IDS is a comma-separated list of User.id
 * (spaces allowed). Empty or unset = capture is off and the bot behaves
 * exactly as before.
 */
export const CAPTURE_ALLOWLIST_ENV = "TELEGRAM_CAPTURE_USER_IDS";

export function parseCaptureAllowlist(raw: string | null | undefined): ReadonlySet<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}

export function isCaptureEnabledForUser(
  userId: string,
  raw: string | null | undefined = process.env[CAPTURE_ALLOWLIST_ENV],
): boolean {
  return parseCaptureAllowlist(raw).has(userId);
}
