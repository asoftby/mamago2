export type PartyInviteMode = "PARALLEL" | "SEQUENTIAL";
export type PartyInviteStatus =
  | "QUEUED" | "SENT" | "QUOTED" | "ACCEPTED" | "CONFIRMED"
  | "DECLINED" | "EXPIRED" | "CANCELLED";

export type PartyInviteQueueEntry = {
  id: string;
  offerId: string;
  businessId: string;
  position: number;
  status: PartyInviteStatus;
  responseDueAt: Date | null;
};
export type PartyDispatchDecision = {
  /** Requires an atomic server-side transition before planning next invitations. */
  expireIds: string[];
  /** Candidate IDs eligible to claim atomically in a separate transaction. */
  dispatchIds: string[];
};

/**
 * Pure policy; does not send messages, claim rows or create requests.
 * Sending requires a separate transactional QUEUED→SENT CAS and outbox write.
 * Fail closed on a malformed/oversized queue, never leak messages to extra businesses.
 */
export function decidePartyInviteDispatch(
  rows: readonly PartyInviteQueueEntry[],
  mode: PartyInviteMode,
  now: Date,
): PartyDispatchDecision {
  if (mode !== "PARALLEL" && mode !== "SEQUENTIAL") throw new Error("Unknown dispatch mode");
  if (rows.length > 5 || !Number.isFinite(now.getTime()))
    throw new Error("Invalid dispatch queue");
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  if (new Set(rows.map(x => x.businessId)).size !== rows.length ||
      new Set(rows.map(x => x.offerId)).size !== rows.length ||
      new Set(rows.map(x => x.position)).size !== rows.length ||
      rows.some(x => !x.id || !x.businessId || !x.offerId || !Number.isInteger(x.position) || x.position < 0)) {
    throw new Error("Duplicate or invalid dispatch candidates");
  }

  // A customer acceptance or confirmed booking wins; no other provider is contacted.
  if (rows.some(x => x.status === "ACCEPTED" || x.status === "CONFIRMED"))
    return { expireIds: [], dispatchIds: [] };

  const expireIds = sorted.filter(x => x.status === "SENT" &&
      x.responseDueAt !== null && x.responseDueAt <= now).map(x => x.id);
  // Do not contact the next candidate while the response timeout is uncommitted.
  if (expireIds.length) return { expireIds, dispatchIds: [] };

  const queued = sorted.filter(x => x.status === "QUEUED");
  if (mode === "PARALLEL") {
    // At most five total, even across reruns. Claimed rows are not QUEUED anymore.
    return { expireIds: [], dispatchIds: queued.map(x => x.id) };
  }
  // Sequential: an unanswered request or valid quote blocks the next invite.
  if (rows.some(x => x.status === "SENT" || x.status === "QUOTED"))
    return { expireIds: [], dispatchIds: [] };
  return { expireIds: [], dispatchIds: queued.length ? [queued[0].id] : [] };
}
