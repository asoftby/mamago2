import assert from "node:assert/strict";
import {
  BUSINESS_CONTACT_VERIFICATION_PURPOSE,
  BUSINESS_PHONE_ALREADY_LINKED_MESSAGE,
  isBusinessPhoneUniqueViolation,
  LEGACY_BUSINESS_PHONE_VERIFY_PURPOSE,
  isE164Phone,
  isVerifiedPhoneMatch,
  verifiedBusinessContactPhone,
  resolveOnboardingVerifiedPhone,
  hasVerifiedPhoneForComments,
  normalizeBusinessContactVerificationPurpose,
} from "./businessContactVerification.shared";

assert.equal(
  normalizeBusinessContactVerificationPurpose(
    BUSINESS_CONTACT_VERIFICATION_PURPOSE
  ),
  BUSINESS_CONTACT_VERIFICATION_PURPOSE
);

assert.equal(
  normalizeBusinessContactVerificationPurpose(
    LEGACY_BUSINESS_PHONE_VERIFY_PURPOSE
  ),
  BUSINESS_CONTACT_VERIFICATION_PURPOSE
);

assert.equal(
  normalizeBusinessContactVerificationPurpose("LOGIN"),
  null
);

assert.equal(isE164Phone("+375291234567"), true);
assert.equal(isE164Phone("375291234567"), false);

assert.equal(
  isVerifiedPhoneMatch({
    currentPhoneE164: "+375291234567",
    verifiedPhoneE164: "+375291234567",
  }),
  true
);

assert.equal(
  isVerifiedPhoneMatch({
    currentPhoneE164: "+375291234567",
    verifiedPhoneE164: "+375441234567",
  }),
  false
);

console.log("businessContactVerification.shared.test.ts passed");

assert.equal(
  isBusinessPhoneUniqueViolation({ code: "P2002", meta: { target: ["phoneE164"] } }),
  true
);
assert.equal(
  isBusinessPhoneUniqueViolation({ code: "P2002", meta: { target: "User_phoneE164_key" } }),
  true
);
assert.equal(
  isBusinessPhoneUniqueViolation({ code: "P2002", meta: { target: ["email"] } }),
  false
);
assert.equal(
  isBusinessPhoneUniqueViolation({ code: "P2025", meta: { target: ["phoneE164"] } }),
  false
);
assert.equal(isBusinessPhoneUniqueViolation(new Error("phoneE164")), false);
assert.equal(isBusinessPhoneUniqueViolation({ code: "P2002" }), false);
assert.match(BUSINESS_PHONE_ALREADY_LINKED_MESSAGE, /другому аккаунту/);
assert.doesNotMatch(BUSINESS_PHONE_ALREADY_LINKED_MESSAGE, /Prisma|P2002|phoneE164/);

const accountPhone = "+375291234567";
const businessPhone = "+375441234567";
const verifiedAt = new Date("2026-11-03T12:00:00Z");

// The user's verified account number is reusable without another SMS.
assert.equal(verifiedBusinessContactPhone({
  phoneE164: accountPhone,
  accountPhoneE164: accountPhone,
  accountPhoneVerifiedAt: verifiedAt,
}), accountPhone);

// Unverified account numbers and client-side drafts are not verification evidence.
assert.equal(verifiedBusinessContactPhone({
  phoneE164: accountPhone,
  accountPhoneE164: accountPhone,
  accountPhoneVerifiedAt: null,
}), "");
assert.equal(verifiedBusinessContactPhone({
  phoneE164: businessPhone,
  accountPhoneE164: accountPhone,
  accountPhoneVerifiedAt: verifiedAt,
}), "");

// The verified business contact may differ from the personal account number.
assert.equal(verifiedBusinessContactPhone({
  phoneE164: businessPhone,
  accountPhoneE164: accountPhone,
  accountPhoneVerifiedAt: verifiedAt,
  businessContactVerifiedPhoneE164: businessPhone,
  businessContactPhoneVerifiedAt: verifiedAt,
}), businessPhone);
assert.equal(verifiedBusinessContactPhone({
  phoneE164: businessPhone,
  existingBusinessPhoneE164: businessPhone,
  existingBusinessContactPhoneVerifiedAt: verifiedAt,
}), businessPhone);

// Either verified source unlocks comments, even before business approval.
assert.equal(hasVerifiedPhoneForComments({
  accountPhoneE164: accountPhone,
  accountPhoneVerifiedAt: verifiedAt,
  businessContactVerifiedPhoneE164: null,
  businessContactPhoneVerifiedAt: null,
}), true);
assert.equal(hasVerifiedPhoneForComments({
  accountPhoneE164: null,
  accountPhoneVerifiedAt: null,
  businessContactVerifiedPhoneE164: businessPhone,
  businessContactPhoneVerifiedAt: verifiedAt,
}), true);
assert.equal(hasVerifiedPhoneForComments({
  accountPhoneE164: accountPhone,
  accountPhoneVerifiedAt: null,
  businessContactVerifiedPhoneE164: businessPhone,
  businessContactPhoneVerifiedAt: null,
}), false);
assert.equal(hasVerifiedPhoneForComments({
  accountPhoneE164: null,
  accountPhoneVerifiedAt: verifiedAt,
  businessContactVerifiedPhoneE164: null,
  businessContactPhoneVerifiedAt: verifiedAt,
}), false);


assert.equal(isBusinessPhoneUniqueViolation({
  code: "P2002", meta: { target: ["businessContactVerifiedPhoneE164"] },
}), true);
assert.equal(isBusinessPhoneUniqueViolation(new Error(BUSINESS_PHONE_ALREADY_LINKED_MESSAGE)), true);

// A newly OTP-confirmed business phone B stays available in the current form
// after an interim selection C. C itself is never marked verified.
const inMemoryVerification = {
  accountPhoneE164: accountPhone,
  accountPhoneVerifiedAt: verifiedAt,
  businessContactVerifiedPhoneE164: null,
  businessContactPhoneVerifiedAt: null,
  recentlyOtpVerifiedPhoneE164: businessPhone,
};
assert.equal(resolveOnboardingVerifiedPhone({
  ...inMemoryVerification,
  phoneE164: businessPhone,
}), businessPhone);
assert.equal(resolveOnboardingVerifiedPhone({
  ...inMemoryVerification,
  phoneE164: "+375331234567",
}), "");
assert.equal(resolveOnboardingVerifiedPhone({
  ...inMemoryVerification,
  phoneE164: businessPhone,
}), businessPhone);
// A localStorage draft alone is not a verification source after page reload.
assert.equal(resolveOnboardingVerifiedPhone({
  phoneE164: businessPhone,
  recentlyOtpVerifiedPhoneE164: null,
}), "");
assert.equal(resolveOnboardingVerifiedPhone({
  ...inMemoryVerification,
  phoneE164: accountPhone,
}), accountPhone);
