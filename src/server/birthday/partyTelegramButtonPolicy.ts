/**
 * A one-tap Telegram confirmation must not choose a room implicitly.
 *
 * Business confirmation selects a room without an explicit unitId only when
 * there is exactly one active mapped unit, or when the accepted quote already
 * binds the unit. An add-on without any mapped unit may confirm manually.
 */
export function canConfirmPartyWithOneTap(input: {
  availableUnitIds: string[];
  activeMappedUnitCount: number;
  acceptedQuoteUnitId: string | null;
  manualAllowed: boolean;
}): boolean {
  if (input.manualAllowed && input.activeMappedUnitCount === 0 &&
      input.availableUnitIds.length === 0) return true;
  if (input.availableUnitIds.length !== 1) return false;
  return input.activeMappedUnitCount === 1 ||
    input.acceptedQuoteUnitId === input.availableUnitIds[0];
}
