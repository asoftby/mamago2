import assert from "node:assert/strict";
import { normalizePhoneToE164 } from "@/lib/phone/phoneNormalize";
import {
  PHONE_OTP_PUBLIC_RESPONSE,
  phoneOtpPublicHttpResponse,
  sendPhoneOtp,
  type PhoneOtpSendDependencies,
  type PhoneOtpPurpose,
} from "./phoneOtpSend.service";

type User = { id: string; email: string };

function createHarness(initialUsers: Record<string, User> = {}) {
  const users = new Map(Object.entries(initialUsers));
  const counters = new Map<string, number>();
  const providerCalls: string[] = [];
  const storedOtps: Array<{ phoneE164: string; purpose: PhoneOtpPurpose }> = [];
  const events: string[] = [];

  const dependencies: PhoneOtpSendDependencies = {
    checkRateLimit: async ({ key, limit }) => {
      const count = (counters.get(key) ?? 0) + 1;
      counters.set(key, count);
      return { allowed: count <= limit };
    },
    findUser: async (phone) => users.get(phone) ?? null,
    createOrGetStub: async (phone, digits) => {
      const user = users.get(phone) ?? {
        id: `stub-${digits}`,
        email: `phone_${digits}@pending.mamago.by`,
      };
      users.set(phone, user);
      return user;
    },
    storeOtp: async ({ phoneE164, purpose }) => {
      storedOtps.push({ phoneE164, purpose });
    },
    generateCode: () => "1234",
    hashCode: (code) => `hash:${code}`,
    sendSms: async (phone) => {
      providerCalls.push(phone);
    },
    now: () => new Date("2026-09-22T00:00:00.000Z"),
    logSecurityEvent: (event) => events.push(event),
  };

  return { dependencies, providerCalls, storedOtps, events, counters };
}

async function request(
  harness: ReturnType<typeof createHarness>,
  phone: string,
  purpose: PhoneOtpPurpose,
  callerIdentity = "203.0.113.1",
) {
  return sendPhoneOtp(
    { phoneE164: normalizePhoneToE164(phone), purpose, callerIdentity },
    harness.dependencies,
  );
}

async function testEnumerationResponses() {
  const existingPhone = "+375291111111";
  const missingPhone = "+375292222222";
  const cases: Array<[string, PhoneOtpPurpose, Record<string, User>]> = [
    [existingPhone, "LOGIN", { [existingPhone]: { id: "real", email: "real@example.com" } }],
    [missingPhone, "LOGIN", {}],
    [existingPhone, "REGISTER", { [existingPhone]: { id: "real", email: "real@example.com" } }],
    [missingPhone, "REGISTER", {}],
  ];

  const responses = [];
  for (const [phone, purpose, users] of cases) {
    const result = await request(createHarness(users), phone, purpose);
    responses.push(phoneOtpPublicHttpResponse(result));
  }

  for (const response of responses) {
    assert.deepEqual(response, { status: 200, body: PHONE_OTP_PUBLIC_RESPONSE });
  }
}

async function testIneligibleDoesNotSpendRecipientOrSms() {
  const realPhone = "+375293333333";
  const loginMissing = createHarness();
  await request(loginMissing, "+375294444444", "LOGIN");
  assert.equal(loginMissing.providerCalls.length, 0);
  assert.equal(loginMissing.storedOtps.length, 0);

  const registerExisting = createHarness({
    [realPhone]: { id: "real", email: "real@example.com" },
  });
  await request(registerExisting, realPhone, "REGISTER");
  assert.equal(registerExisting.providerCalls.length, 0);
  assert.equal(registerExisting.storedOtps.length, 0);
}

async function testCallerRotationAndPurposeRotation() {
  const users: Record<string, User> = {};
  for (let index = 0; index < 6; index += 2) {
    users[`+37529${String(1000000 + index).slice(-7)}`] = {
      id: `real-${index}`,
      email: `real-${index}@example.com`,
    };
  }
  const harness = createHarness(users);
  const results = [];
  for (let index = 0; index < 6; index += 1) {
    const phone = `+37529${String(1000000 + index).slice(-7)}`;
    results.push(await request(harness, phone, index % 2 === 0 ? "LOGIN" : "REGISTER"));
  }
  assert.equal(harness.providerCalls.length, 3);
  assert.equal(results.at(-1), "rate_limited");
  assert.ok(harness.events.includes("OTP_RATE_LIMIT_CALLER"));
}

async function testRecipientAndNormalization() {
  const canonical = "+375291234567";
  const harness = createHarness({
    [canonical]: { id: "real", email: "real@example.com" },
  });
  const formats = [canonical, "375291234567", "8 (029) 123-45-67"];
  for (const [index, phone] of formats.entries()) {
    await request(harness, phone, "LOGIN", `203.0.113.${index + 1}`);
  }
  assert.equal(harness.providerCalls.length, 1);
  assert.ok(harness.events.includes("OTP_RATE_LIMIT_RECIPIENT"));
  assert.deepEqual(
    [...harness.counters.entries()]
      .filter(([key]) => key.includes("otp:sms:recipient:hour:"))
      .map(([, count]) => count),
    [1],
    "cooldown denials must not consume the longer recipient budget",
  );
}

async function testGlobalAndConcurrency() {
  const harness = createHarness();
  const results = await Promise.all(
    Array.from({ length: 40 }, (_, index) => {
      const phone = `+37533${String(1000000 + index).slice(-7)}`;
      return request(harness, phone, "REGISTER", `198.51.100.${index + 1}`);
    }),
  );
  assert.equal(harness.providerCalls.length, 30);
  assert.equal(results.filter((result) => result === "rate_limited").length, 10);
  assert.ok(harness.events.includes("OTP_RATE_LIMIT_GLOBAL"));
}

async function testUnknownCallerIsBounded() {
  const harness = createHarness();
  for (let index = 0; index < 5; index += 1) {
    const phone = `+37544${String(1000000 + index).slice(-7)}`;
    await request(harness, phone, "REGISTER", "unknown");
  }
  assert.equal(harness.providerCalls.length, 3);
}

async function testProviderFailureConsumesQuota() {
  const phone = "+375447777777";
  const harness = createHarness({
    [phone]: { id: "real", email: "real@example.com" },
  });
  let attempts = 0;
  harness.dependencies.sendSms = async () => {
    attempts += 1;
    throw new Error("provider unavailable");
  };

  const first = await request(harness, phone, "LOGIN", "192.0.2.1");
  const second = await request(harness, phone, "LOGIN", "192.0.2.2");
  assert.equal(first, "accepted");
  assert.equal(second, "accepted");
  assert.equal(attempts, 1);
  assert.ok(harness.events.includes("SMS_PROVIDER_FAILURE"));
}

async function main() {
  await testEnumerationResponses();
  await testIneligibleDoesNotSpendRecipientOrSms();
  await testCallerRotationAndPurposeRotation();
  await testRecipientAndNormalization();
  await testGlobalAndConcurrency();
  await testUnknownCallerIsBounded();
  await testProviderFailureConsumesQuota();
  console.log("phone OTP send security tests: OK");
}

void main();
