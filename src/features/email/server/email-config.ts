import { getConfiguredPublicAppUrl } from "@/lib/config/publicAppUrl";

export function isEmailEnabled(): boolean {
  return process.env.EMAIL_ENABLED === "true";
}

export function getDebugRedirectTo(): string | undefined {
  const v = process.env.EMAIL_DEBUG_REDIRECT_TO?.trim();
  return v || undefined;
}

export function resolveEmailRecipient(intendedTo: string): {
  actualTo: string;
  debugRedirect: boolean;
} {
  const debugTo = getDebugRedirectTo();
  return {
    actualTo: debugTo ?? intendedTo,
    debugRedirect: Boolean(debugTo),
  };
}

export function getMissingResendEnvKeys(): string[] {
  const missing: string[] = [];
  if (!process.env.RESEND_API_KEY?.trim()) missing.push("RESEND_API_KEY");
  if (!process.env.EMAIL_FROM?.trim()) missing.push("EMAIL_FROM");
  if (!process.env.EMAIL_REPLY_TO?.trim()) missing.push("EMAIL_REPLY_TO");
  return missing;
}

export function getEmailDeliveryConfigurationStatus(): {
  enabled: boolean;
  configured: boolean;
  missingKeys: string[];
  debugRedirect: boolean;
  from: string | null;
  replyTo: string | null;
  publicUrl: string | null;
} {
  const enabled = isEmailEnabled();
  const missingKeys = getMissingResendEnvKeys();
  return {
    enabled,
    configured: enabled && missingKeys.length === 0,
    missingKeys,
    debugRedirect: Boolean(getDebugRedirectTo()),
    from: process.env.EMAIL_FROM?.trim() || null,
    replyTo: process.env.EMAIL_REPLY_TO?.trim() || null,
    publicUrl: getConfiguredPublicAppUrl(),
  };
}
