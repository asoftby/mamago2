/** PostgreSQL overlap semantics: start < requested end AND end > requested start. */
export function overlapsBookingWindow(
  block: { blockStart: Date; blockEnd: Date },
  window: { blockStart: Date; blockEnd: Date },
): boolean {
  return block.blockStart < window.blockEnd && block.blockEnd > window.blockStart;
}
