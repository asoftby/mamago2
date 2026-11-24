/**
 * Return stable, unique delivery recipients for a business booking.
 * Membership authorization is performed in the caller's DB query.
 */
export function businessNotificationRecipients(
  ownerUserId: string | null,
  members: ReadonlyArray<{ userId: string }>,
): string[] {
  const recipients = new Set(members.map((member) => member.userId));
  if (ownerUserId) recipients.add(ownerUserId);
  return [...recipients];
}
