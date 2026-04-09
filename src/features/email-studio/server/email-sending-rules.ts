/**
 * Email Sending Domain Rules
 *
 * Defines which emails respect user preferences and which are always sent.
 *
 * Classification:
 *
 * TRANSACTIONAL — always sent, ignore User.marketingEmailsEnabled:
 *   VERIFY_EMAIL    — account verification, critical
 *   RESET_PASSWORD  — password recovery, critical
 *   WELCOME         — onboarding trigger, sent once at registration
 *                     (not a recurring marketing email; user cannot have opted out yet)
 *
 * MARKETING — respect User.marketingEmailsEnabled:
 *   WEEKLY_DIGEST   — recurring editorial content
 *   PROMO_CAMPAIGN  — promotional campaigns
 *   PLAN_REMINDER   — recurring engagement nudge
 *   CUSTOM          — unknown intent, treat as marketing by default
 */

import "server-only";

export type EmailCategory = "marketing" | "transactional";

export function getEmailCategory(
  templateType: "WELCOME" | "VERIFY_EMAIL" | "RESET_PASSWORD" | "PLAN_REMINDER" | "WEEKLY_DIGEST" | "PROMO_CAMPAIGN" | "CUSTOM",
): EmailCategory {
  switch (templateType) {
    // Transactional: always sent regardless of user preferences
    case "VERIFY_EMAIL":
    case "RESET_PASSWORD":
    case "WELCOME":
      return "transactional";

    // Marketing: respect User.marketingEmailsEnabled
    case "PLAN_REMINDER":
    case "WEEKLY_DIGEST":
    case "PROMO_CAMPAIGN":
    case "CUSTOM":
      return "marketing";

    default: {
      const neverType: never = templateType;
      return neverType;
    }
  }
}

/**
 * Returns true if the email should be sent to this user.
 *
 * Transactional emails always return true.
 * Marketing emails return false if user has opted out.
 */
export function shouldSendEmail(
  templateType: "WELCOME" | "VERIFY_EMAIL" | "RESET_PASSWORD" | "PLAN_REMINDER" | "WEEKLY_DIGEST" | "PROMO_CAMPAIGN" | "CUSTOM",
  userMarketingEmailsEnabled: boolean,
): boolean {
  if (getEmailCategory(templateType) === "transactional") {
    return true;
  }
  return userMarketingEmailsEnabled;
}

export function isTransactionalEmail(
  templateType: "WELCOME" | "VERIFY_EMAIL" | "RESET_PASSWORD" | "PLAN_REMINDER" | "WEEKLY_DIGEST" | "PROMO_CAMPAIGN" | "CUSTOM",
): boolean {
  return getEmailCategory(templateType) === "transactional";
}
