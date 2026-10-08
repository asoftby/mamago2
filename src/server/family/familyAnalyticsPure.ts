/** Pure: per user, the later (youngest) of two birth dates. Family rows overlay legacy rows. */
export function mergeYoungestBirthDates(
  legacy: Map<string, Date>,
  family: Map<string, Date>,
): Map<string, Date> {
  const out = new Map(legacy);
  for (const [userId, birth] of family) {
    const prev = out.get(userId);
    out.set(userId, prev && prev > birth ? prev : birth);
  }
  return out;
}

/** Pure: unit of measure for plan "users" counts — the family when known, else the user. */
export function planCountUnit(row: { familyId: string | null; userId: string }): string {
  return row.familyId ? `f:${row.familyId}` : `u:${row.userId}`;
}
