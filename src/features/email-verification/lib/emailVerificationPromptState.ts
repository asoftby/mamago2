"use client";

const SESSION_SENT_PREFIX = "mamago_email_verify_prompt_sent";

function sentKey(userId: string | undefined) {
  return userId ? `${SESSION_SENT_PREFIX}:${userId}` : SESSION_SENT_PREFIX;
}

export function isEmailVerificationPromptSent(userId: string | undefined): boolean {
  if (!userId) return false;
  try {
    return sessionStorage.getItem(sentKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markEmailVerificationPromptSent(userId: string | undefined): void {
  if (!userId) return;
  try {
    sessionStorage.setItem(sentKey(userId), "1");
  } catch {
    // ignore storage failures
  }
}

