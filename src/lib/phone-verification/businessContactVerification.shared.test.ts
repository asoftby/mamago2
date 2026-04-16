import assert from "node:assert/strict";
import {
  BUSINESS_CONTACT_VERIFICATION_PURPOSE,
  LEGACY_BUSINESS_PHONE_VERIFY_PURPOSE,
  isE164Phone,
  isVerifiedPhoneMatch,
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
