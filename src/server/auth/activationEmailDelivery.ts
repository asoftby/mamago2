import { resolveActivationEmailDelivery, type ActivationEmailEnvironment } from "./activationEmailGate";
// Type-only: erased at compile time, so this never triggers email-service.tsx's
// `import "server-only"` side effect for callers of this module (this file's
// own tests run under plain tsx/Node, not Next's react-server condition).
import type { EmailService } from "@/features/email/server/email-service";

/**
 * Production activation email provider adapter. This is the one seam
 * `resolveActivationEmailDelivery()` deliberately left unfilled ("Provider
 * connection is intentionally outside Slice 3"). Reuses the existing
 * `emailService`/Resend infrastructure — no second email pipeline.
 *
 * Every function here has zero top-level side effects (all env reads happen
 * inside function bodies), so importing this module never requires
 * RESEND_API_KEY/EMAIL_FROM/etc. to exist — a LOCAL build with no email
 * secrets configured still compiles and runs. The real `emailService` is
 * imported lazily (dynamic `import()`), only when a send is actually about
 * to happen and no test/rehearsal sender was injected — so requiring this
 * module never pulls in `email-service.tsx`'s `"server-only"` guard.
 */

type RawEmailSender = EmailService["sendRawEmail"];

async function defaultSender(params: Parameters<RawEmailSender>[0]): ReturnType<RawEmailSender> {
  const { emailService } = await import("@/features/email/server/email-service");
  return emailService.sendRawEmail(params);
}

function activationBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

/** `null` when NEXT_PUBLIC_APP_URL isn't configured — callers must treat that as "cannot deliver", never fall back to a guessed host. */
export function buildMigratedAccountActivationUrl(rawToken: string): string | null {
  const base = activationBaseUrl();
  if (!base) return null;
  return `${base}/activate?token=${encodeURIComponent(rawToken)}`;
}

export interface MigratedAccountActivationEmailContent {
  subject: string;
  text: string;
}

/** Pure content builder — takes the already-built URL, never the raw token directly, so a caller can't accidentally log the content and miss that it embeds a secret. */
export function buildMigratedAccountActivationEmailContent(activationUrl: string): MigratedAccountActivationEmailContent {
  return {
    subject: "Активируйте аккаунт mamaGo",
    text: [
      "Здравствуйте!",
      "",
      "Чтобы активировать аккаунт mamaGo и задать пароль, перейдите по ссылке:",
      activationUrl,
      "",
      "Ссылка действительна 1 час и может быть использована только один раз.",
      "Если вы не запрашивали активацию, просто проигнорируйте это письмо.",
    ].join("\n"),
  };
}

export type DeliverMigratedAccountActivationEmailResult =
  | { status: "SKIPPED"; reason: string }
  | { status: "SENT"; messageId?: string }
  | { status: "FAILED"; reason: string };

/**
 * The one function allowed to turn a freshly-issued raw activation token
 * into an outbound email. `rawToken` lives only for the duration of this
 * call — used once to build the URL, embedded once into the email body,
 * never assigned to a module-level variable, never passed to `console.*`.
 *
 * `sender` is injectable (defaults to the real `emailService.sendRawEmail`)
 * purely so a rehearsal/test can supply a fake/sandbox transport without
 * this module knowing it's being rehearsed — production code path is
 * identical either way. `gateEnvironment` is the same idea applied to the
 * env-based gate: a rehearsal can prove the "all flags approved" branch
 * without mutating real `process.env` (which would leak into every other
 * module in the same test process).
 */
export async function deliverMigratedAccountActivationEmail(
  params: { to: string; rawToken: string },
  sender?: RawEmailSender,
  gateEnvironment?: ActivationEmailEnvironment,
): Promise<DeliverMigratedAccountActivationEmailResult> {
  const gate = resolveActivationEmailDelivery(gateEnvironment);
  if (gate.status === "DELIVERY_DISABLED") {
    return { status: "SKIPPED", reason: "DELIVERY_DISABLED" };
  }

  const activationUrl = buildMigratedAccountActivationUrl(params.rawToken);
  if (!activationUrl) {
    return { status: "SKIPPED", reason: "ACTIVATION_BASE_URL_NOT_CONFIGURED" };
  }

  const content = buildMigratedAccountActivationEmailContent(activationUrl);
  const send = sender ?? defaultSender;
  const result = await send({ to: params.to, subject: content.subject, text: content.text });

  if (result.status === "SENT") return { status: "SENT", messageId: result.messageId };
  if (result.status === "SKIPPED") return { status: "SKIPPED", reason: result.reason ?? "EMAIL_DISABLED" };
  return { status: "FAILED", reason: result.reason ?? "EMAIL_SEND_FAILED" };
}
