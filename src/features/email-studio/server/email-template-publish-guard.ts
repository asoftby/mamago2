/**
 * Email Template Publish Guard
 *
 * Validates a template before publishing.
 * Enforces unsubscribe footer rules based on template type.
 *
 * Rules:
 * - Transactional (VERIFY_EMAIL, RESET_PASSWORD): no unsubscribe required
 * - Hard block (PROMO_CAMPAIGN, WEEKLY_DIGEST): must have footer with showUnsubscribe=true
 * - Soft warning (WELCOME, PLAN_REMINDER, CUSTOM): unsubscribe recommended, not required
 */

import type { EmailTemplateType } from "@prisma/client";
import type { EmailTemplateDocument } from "@/features/email-studio/lib";

// ─── Result type ────────────────────────────────────────────────────────────

export type EmailPublishGuardResult =
  | { ok: true; warning?: EmailPublishWarning }
  | { ok: false; severity: "error"; code: EmailPublishGuardCode; message: string };

export type EmailPublishWarning = {
  code: EmailPublishGuardCode;
  message: string;
};

export type EmailPublishGuardCode = "UNSUBSCRIBE_MISSING";

// ─── Classification ──────────────────────────────────────────────────────────

type UnsubscribeRequirement = "required" | "recommended" | "not_required";

function getUnsubscribeRequirement(type: EmailTemplateType): UnsubscribeRequirement {
  switch (type) {
    // Transactional — unsubscribe не нужен
    case "VERIFY_EMAIL":
    case "RESET_PASSWORD":
    case "WELCOME":
      return "not_required";

    // Hard block — unsubscribe обязателен
    case "PROMO_CAMPAIGN":
    case "WEEKLY_DIGEST":
      return "required";

    // Soft warning — unsubscribe желателен
    case "PLAN_REMINDER":
    case "CUSTOM":
      return "recommended";

    default: {
      const neverType: never = type;
      return neverType;
    }
  }
}

// ─── Document inspection ─────────────────────────────────────────────────────

function hasFooterWithUnsubscribe(document: EmailTemplateDocument): boolean {
  return document.blocks.some(
    (block) => block.type === "footer" && block.showUnsubscribe === true,
  );
}

// ─── Guard ───────────────────────────────────────────────────────────────────

/**
 * Validate a template before publishing.
 *
 * @returns
 *   - `{ ok: true }` — publish allowed, no issues
 *   - `{ ok: true, warning }` — publish allowed, but UI should show a warning
 *   - `{ ok: false, severity: "error" }` — publish blocked
 *
 * @example
 * const guard = validateEmailTemplatePublishRules(template.type, template.document);
 * if (!guard.ok) throw createEmailTemplateInvalidError(guard.message);
 * // proceed with publish, optionally surface guard.warning
 */
export function validateEmailTemplatePublishRules(
  type: EmailTemplateType,
  document: EmailTemplateDocument,
): EmailPublishGuardResult {
  const requirement = getUnsubscribeRequirement(type);

  // Transactional — always ok
  if (requirement === "not_required") {
    return { ok: true };
  }

  const hasUnsubscribe = hasFooterWithUnsubscribe(document);

  if (hasUnsubscribe) {
    return { ok: true };
  }

  // Hard block for PROMO_CAMPAIGN / WEEKLY_DIGEST
  if (requirement === "required") {
    return {
      ok: false,
      severity: "error",
      code: "UNSUBSCRIBE_MISSING",
      message:
        "Шаблон этого типа обязан содержать footer с включённой ссылкой отписки. " +
        "Добавьте блок «Футер» и включите «Показывать ссылку отписки».",
    };
  }

  // Soft warning for WELCOME / PLAN_REMINDER / CUSTOM
  return {
    ok: true,
    warning: {
      code: "UNSUBSCRIBE_MISSING",
      message:
        "Рекомендуется добавить footer с ссылкой отписки для маркетинговых писем. " +
        "Шаблон опубликован, но получатели не смогут отписаться.",
    },
  };
}
