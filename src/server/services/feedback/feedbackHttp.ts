import { NextResponse } from "next/server";
import { FeedbackDomainError } from "./feedbackErrors";

/** Write endpoints (ratings, texts, withdrawals). Off by default. */
export function isStarWriteEnabled(): boolean {
  return process.env.FEEDBACK_V1_WRITE_ENABLED === "1";
}

/** Read endpoints: on with the write flag or with the star UI flag. */
export function isStarReadEnabled(): boolean {
  return isStarWriteEnabled() || process.env.FEEDBACK_STARS_UI_ENABLED === "1";
}

export function featureDisabled(): NextResponse {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

export function feedbackErrorResponse(error: unknown, scope: string): NextResponse {
  if (error instanceof FeedbackDomainError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  console.error(`[feedback] ${scope} failed`, error);
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}
