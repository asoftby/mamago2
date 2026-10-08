export function buildMeProfileUpdateData(body: unknown): Record<string, unknown> {
  const input = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const updateData: Record<string, unknown> = {};

  if (typeof input.displayName === "string") updateData.displayName = input.displayName.trim();
  if (typeof input.familyRole === "string" || input.familyRole === null) {
    updateData.familyRole = typeof input.familyRole === "string" ? input.familyRole || null : null;
  }
  if (typeof input.ageBandLabel === "string") updateData.ageBandLabel = input.ageBandLabel || null;
  if (Array.isArray(input.preferenceSignalIds)) updateData.preferenceSignalIds = input.preferenceSignalIds;
  if (typeof input.leisureFormatSignalId === "string" || input.leisureFormatSignalId === null) {
    updateData.leisureFormatSignalId = input.leisureFormatSignalId;
  }
  if (typeof input.preferenceSummary === "string" || input.preferenceSummary === null) {
    updateData.preferenceSummary = input.preferenceSummary;
  }
  if (typeof input.leisureFormatSummary === "string" || input.leisureFormatSummary === null) {
    updateData.leisureFormatSummary = input.leisureFormatSummary;
  }
  return updateData;
}
