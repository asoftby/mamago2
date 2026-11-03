import assert from "node:assert/strict";
import {
  PHONE_OTP_PUBLIC_RESPONSE,
  phoneOtpPublicHttpResponse,
  sendPhoneOtp,
  type PhoneOtpPurpose,
  type PhoneOtpSendDependencies,
} from "./phoneOtpSend.service";

const phone = "+375441234567";
const customer = { id: "customer", email: "person@example.com" };
const stub = { id: "stub", email: "phone_375441234567@pending.mamago.by" };

async function check(params: {
  purpose: PhoneOtpPurpose;
  owner?: { id: string; email: string } | null;
  reserved?: boolean;
  callerAllowed?: boolean;
}) {
  const calls = { reservations: 0, stubs: 0, otpWrites: 0, sms: 0 };
  const dependencies: PhoneOtpSendDependencies = {
    checkRateLimit: async () => ({ allowed: params.callerAllowed !== false }),
    findUser: async () => params.owner ?? null,
    isBusinessContactReserved: async () => {
      calls.reservations++;
      return params.reserved ?? false;
    },
    createOrGetStub: async () => {
      calls.stubs++;
      return stub;
    },
    storeOtp: async () => { calls.otpWrites++; },
    generateCode: () => "1234",
    hashCode: () => "opaque-code-hash",
    sendSms: async () => { calls.sms++; },
  };
  const result = await sendPhoneOtp(
    { phoneE164: phone, callerIdentity: "synthetic-test-caller", purpose: params.purpose },
    dependencies,
  );
  return { result, calls };
}

async function run() {
  // A verified business contact may belong to an account without a personal phone.
  // No REGISTER stub/OTP/SMS may be created, and the public response stays generic.
  const reserved = await check({ purpose: "REGISTER", reserved: true });
  assert.equal(reserved.result, "accepted");
  assert.deepEqual(
    { stubs: reserved.calls.stubs, otpWrites: reserved.calls.otpWrites, sms: reserved.calls.sms },
    { stubs: 0, otpWrites: 0, sms: 0 },
  );
  assert.equal(reserved.calls.reservations, 1);
  assert.deepEqual(phoneOtpPublicHttpResponse(reserved.result).body, PHONE_OTP_PUBLIC_RESPONSE);

  // Do not recycle a previously created registration stub if the phone was
  // subsequently verified by a business owner.
  const reservedWithStub = await check({
    purpose: "REGISTER", owner: stub, reserved: true,
  });
  assert.equal(reservedWithStub.result, "accepted");
  assert.equal(reservedWithStub.calls.otpWrites, 0);
  assert.equal(reservedWithStub.calls.sms, 0);

  const normalRegistration = await check({ purpose: "REGISTER" });
  assert.equal(normalRegistration.result, "accepted");
  assert.equal(normalRegistration.calls.stubs, 1);
  assert.equal(normalRegistration.calls.otpWrites, 1);
  assert.equal(normalRegistration.calls.sms, 1);

  const existingAccount = await check({ purpose: "REGISTER", owner: customer });
  assert.equal(existingAccount.result, "accepted");
  assert.equal(existingAccount.calls.stubs, 0);
  assert.equal(existingAccount.calls.otpWrites, 0);

  // LOGIN still authenticates only by the account's personal phone, not business contact.
  const businessPhoneLogin = await check({ purpose: "LOGIN", reserved: true });
  assert.equal(businessPhoneLogin.result, "accepted");
  assert.equal(businessPhoneLogin.calls.reservations, 0);
  assert.equal(businessPhoneLogin.calls.otpWrites, 0);
  assert.equal(businessPhoneLogin.calls.sms, 0);

  const personalPhoneLogin = await check({ purpose: "LOGIN", owner: customer });
  assert.equal(personalPhoneLogin.result, "accepted");
  assert.equal(personalPhoneLogin.calls.reservations, 0);
  assert.equal(personalPhoneLogin.calls.otpWrites, 1);
  assert.equal(personalPhoneLogin.calls.sms, 1);

  const limited = await check({ purpose: "REGISTER", reserved: true, callerAllowed: false });
  assert.equal(limited.result, "rate_limited");
  assert.equal(limited.calls.reservations, 0);
  assert.equal(limited.calls.otpWrites, 0);

  console.log("phoneOtpSend.businessContact.test.ts passed");
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
