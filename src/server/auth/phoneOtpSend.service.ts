import { createHash } from "node:crypto";

export type PhoneOtpPurpose = "LOGIN" | "REGISTER";

export const PHONE_OTP_PUBLIC_RESPONSE = {
  success: true,
  message: "Если номер подходит для этого действия, код будет отправлен.",
} as const;

export const PHONE_OTP_RATE_LIMITS = {
  recipient: [
    { name: "minute", limit: 1, windowMs: 60_000 },
    { name: "hour", limit: 5, windowMs: 60 * 60_000 },
    { name: "day", limit: 10, windowMs: 24 * 60 * 60_000 },
  ],
  caller: [
    { name: "five-minutes", limit: 3, windowMs: 5 * 60_000 },
    { name: "hour", limit: 10, windowMs: 60 * 60_000 },
    { name: "day", limit: 20, windowMs: 24 * 60 * 60_000 },
  ],
  global: [
    { name: "minute", limit: 30, windowMs: 60_000 },
    { name: "hour", limit: 500, windowMs: 60 * 60_000 },
    { name: "day", limit: 3_000, windowMs: 24 * 60 * 60_000 },
  ],
} as const;

type RateLimitRule = {
  name: string;
  limit: number;
  windowMs: number;
};

type RateLimitCheck = (params: {
  key: string;
  limit: number;
  windowMs: number;
}) => Promise<{ allowed: boolean }>;

type OtpUser = {
  id: string;
  email: string;
};

export type PhoneOtpSendDependencies = {
  checkRateLimit: RateLimitCheck;
  findUser: (phoneE164: string) => Promise<OtpUser | null>;
  createOrGetStub: (phoneE164: string, phoneDigits: string) => Promise<OtpUser>;
  storeOtp: (params: {
    userId: string;
    phoneE164: string;
    purpose: PhoneOtpPurpose;
    codeHash: string;
    expiresAt: Date;
    now: Date;
  }) => Promise<void>;
  generateCode: () => string;
  hashCode: (code: string) => string;
  sendSms: (phoneDigits: string, code: string) => Promise<void>;
  now?: () => Date;
  logSecurityEvent?: (event: string) => void;
};

export type PhoneOtpSendResult = "accepted" | "rate_limited";

export function phoneOtpPublicHttpResponse(result: PhoneOtpSendResult): {
  status: number;
  body: typeof PHONE_OTP_PUBLIC_RESPONSE | { error: string };
} {
  if (result === "rate_limited") {
    return {
      status: 429,
      body: { error: "Слишком много запросов. Попробуйте позже." },
    };
  }
  return { status: 200, body: PHONE_OTP_PUBLIC_RESPONSE };
}

function opaqueKey(scope: string, identity: string, window: string): string {
  const digest = createHash("sha256").update(identity, "utf8").digest("hex");
  return `otp:sms:${scope}:${window}:${digest}`;
}

function globalKey(window: string): string {
  return `otp:sms:global:${window}`;
}

async function consumeRules(
  check: RateLimitCheck,
  scope: "caller" | "recipient" | "global",
  identity: string,
  rules: readonly RateLimitRule[],
): Promise<boolean> {
  // Shortest window first. A denied cooldown must not consume longer recipient
  // send budgets when no provider attempt will be made.
  for (const rule of rules) {
    const result = await check({
      key: scope === "global" ? globalKey(rule.name) : opaqueKey(scope, identity, rule.name),
      limit: rule.limit,
      windowMs: rule.windowMs,
    });
    if (!result.allowed) return false;
  }
  return true;
}

function isStubUser(user: OtpUser | null): boolean {
  return user?.email.endsWith("@pending.mamago.by") ?? false;
}

export async function sendPhoneOtp(
  params: {
    phoneE164: string;
    callerIdentity: string;
    purpose: PhoneOtpPurpose;
  },
  dependencies: PhoneOtpSendDependencies,
): Promise<PhoneOtpSendResult> {
  const [callerAllowed, globalAllowed] = await Promise.all([
    consumeRules(
      dependencies.checkRateLimit,
      "caller",
      params.callerIdentity,
      PHONE_OTP_RATE_LIMITS.caller,
    ),
    consumeRules(
      dependencies.checkRateLimit,
      "global",
      "global",
      PHONE_OTP_RATE_LIMITS.global,
    ),
  ]);

  if (!callerAllowed || !globalAllowed) {
    dependencies.logSecurityEvent?.(
      !globalAllowed ? "OTP_RATE_LIMIT_GLOBAL" : "OTP_RATE_LIMIT_CALLER",
    );
    return "rate_limited";
  }

  const existingUser = await dependencies.findUser(params.phoneE164);
  const realUser = existingUser !== null && !isStubUser(existingUser);
  const eligible = params.purpose === "LOGIN" ? realUser : !realUser;

  if (!eligible) {
    return "accepted";
  }

  const recipientAllowed = await consumeRules(
    dependencies.checkRateLimit,
    "recipient",
    params.phoneE164,
    PHONE_OTP_RATE_LIMITS.recipient,
  );
  if (!recipientAllowed) {
    dependencies.logSecurityEvent?.("OTP_RATE_LIMIT_RECIPIENT");
    return "accepted";
  }

  const phoneDigits = params.phoneE164.replace(/\D/g, "");
  const user = existingUser ?? await dependencies.createOrGetStub(params.phoneE164, phoneDigits);
  const now = dependencies.now?.() ?? new Date();
  const code = dependencies.generateCode();

  await dependencies.storeOtp({
    userId: user.id,
    phoneE164: params.phoneE164,
    purpose: params.purpose,
    codeHash: dependencies.hashCode(code),
    expiresAt: new Date(now.getTime() + 10 * 60_000),
    now,
  });

  try {
    await dependencies.sendSms(phoneDigits, code);
  } catch {
    // Do not refund any budget: provider failures must not enable free retries.
    dependencies.logSecurityEvent?.("SMS_PROVIDER_FAILURE");
  }

  return "accepted";
}
