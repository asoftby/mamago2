import type { ContentStatus, Role } from "@prisma/client";

import type { PlaceWizardMode } from "./types";

export type PlaceWizardSubmitAction =
  | "CREATE"
  | "APPROVE_PENDING"
  | "SUBMIT_EXISTING"
  | "SAVE_PUBLISHED_DIRECT"
  | "SUBMIT_PUBLISHED_REVISION"
  | "FORBIDDEN";

/**
 * Single source of truth for what the wizard's primary submit button does,
 * fed into `handleSubmit`. Never re-derive this ad hoc per branch — the
 * status/role matrix here is exactly what the server independently
 * enforces (`PATCH .../route.ts`, `approvePlace`), so client and server
 * must never diverge on who is allowed to do what.
 *
 * - `create`: the entity doesn't exist yet — always `CREATE`.
 * - `PENDING`: under moderation review. Only staff (ADMIN/MODERATOR) may
 *   approve it (`APPROVE_PENDING` — publish it, the same PENDING → PUBLISHED
 *   transition the moderation queue's own Approve button performs).
 *   Everyone else is `FORBIDDEN` — the button must never fall through to
 *   `/submit`, which only accepts DRAFT/REJECTED/NEEDS_REVISION and
 *   correctly rejects PENDING with "Cannot submit from status: PENDING".
 * - `DRAFT`/`REJECTED`/`NEEDS_REVISION`: unchanged — `SUBMIT_EXISTING`
 *   (`POST .../submit`), for owner and staff alike.
 * - `PUBLISHED`: `SAVE_PUBLISHED_DIRECT` only for ADMIN (matches the PATCH
 *   endpoint's own `user.role !== "ADMIN"` revision-required gate exactly —
 *   MODERATOR is not exempt from the revision flow there); everyone else
 *   (including MODERATOR) is `SUBMIT_PUBLISHED_REVISION`.
 */
export function resolvePlaceWizardSubmitAction(params: {
  mode: PlaceWizardMode;
  status: ContentStatus | null | undefined;
  userRole: Role | undefined;
}): PlaceWizardSubmitAction {
  const { mode, status, userRole } = params;

  if (mode === "create") return "CREATE";

  const isStaff = userRole === "ADMIN" || userRole === "MODERATOR";

  switch (status) {
    case "PENDING":
      return isStaff ? "APPROVE_PENDING" : "FORBIDDEN";
    case "DRAFT":
    case "REJECTED":
    case "NEEDS_REVISION":
      return "SUBMIT_EXISTING";
    case "PUBLISHED":
      return userRole === "ADMIN" ? "SAVE_PUBLISHED_DIRECT" : "SUBMIT_PUBLISHED_REVISION";
    default:
      return "FORBIDDEN";
  }
}
