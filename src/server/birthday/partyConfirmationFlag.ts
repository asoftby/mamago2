import { PartyApiError } from "./partyDraft.validation";

/**
 * Server-side release gate for party confirmations (#818): parent acceptance of an offer,
 * the business confirmation (site and Telegram) and the fixed-price auto-confirmation
 * all require PARTY_CONFIRMATION_ENABLED=true. Off by default, enabled per environment
 * after the DEV smoke (docs/birthday/bookings-inbox-ui.md).
 */
export function isPartyConfirmationEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.PARTY_CONFIRMATION_ENABLED === "true";
}

export function assertPartyConfirmationEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  if (!isPartyConfirmationEnabled(env)) {
    throw new PartyApiError(503, "Подтверждение праздничных заявок временно недоступно");
  }
}
