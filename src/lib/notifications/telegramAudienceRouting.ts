/**
 * Keep the Business Bot channel isolated from the family Info Bot.
 * A disabled or unlinked Business Bot must never trigger a fallback send.
 */
export function mayUseFamilyTelegramBot(audience: string | null): boolean {
  return audience !== "BUSINESS";
}
