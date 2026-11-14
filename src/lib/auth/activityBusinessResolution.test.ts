import assert from "node:assert/strict";
import {
  resolveActivityBusinessIdForCreate,
  resolveActivityBusinessIdForPatch,
} from "./activityBusinessResolution";

// Event ownership is separate from the informational Organizer and editor.
assert.equal(
  resolveActivityBusinessIdForPatch({
    existingBusinessId: null,
    authorBusinessId: "author-business",
  }),
  "author-business",
);

// Do not move existing bookings to a different business.
assert.equal(
  resolveActivityBusinessIdForPatch({
    existingBusinessId: "original-recipient",
    authorBusinessId: "author-business",
  }),
  "original-recipient",
);

// An author without a business stays without a business; booking requires a
// separate author-owned recipient/inbox flow, not a fabricated business.
assert.equal(
  resolveActivityBusinessIdForPatch({
    existingBusinessId: null,
    authorBusinessId: null,
  }),
  null,
);

assert.equal(
  resolveActivityBusinessIdForCreate({
    placeOwnerBusinessId: null,
    requestedBusinessId: null,
    userBusinessId: "creator-business",
  }),
  "creator-business",
);


import { BookingMode } from "@prisma/client";
import { deriveEventRequestBookingColumns } from "@/lib/event/eventRequestBookingColumns";

// Real-world legacy event pattern: PUBLISHED, time-slots configured but
// booking columns disabled because the author Business recipient is missing.
// The guarded PATCH recipient repair must also enable native booking.
const legacySchedule = {
  participationMode: "time-slots",
  timeSlots: {
    dates: [{
      isoDate: "2026-11-15",
      slots: [{ startTime: "10:30", endTime: "11:30", capacity: 1 }],
    }],
  },
};
const legacyBookingColumns = { bookingEnabled: false, bookingMode: null };

const withAuthorRecipient = deriveEventRequestBookingColumns({
  participationMode: legacySchedule.participationMode,
  previousParticipationMode: legacySchedule.participationMode,
  scheduleJson: legacySchedule,
  current: legacyBookingColumns,
  hasBusiness: true,
});
assert.deepEqual(withAuthorRecipient, {
  bookingEnabled: true,
  bookingMode: BookingMode.USE_PUBLICATION_SLOTS,
});

const withoutRecipient = deriveEventRequestBookingColumns({
  participationMode: legacySchedule.participationMode,
  previousParticipationMode: legacySchedule.participationMode,
  scheduleJson: legacySchedule,
  current: legacyBookingColumns,
  hasBusiness: false,
});
assert.equal(withoutRecipient, null, "No Business recipient must never enable booking");

console.log("activityBusinessResolution: ok");
