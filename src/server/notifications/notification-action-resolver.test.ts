import { describe, expect, it } from "vitest";
import { resolveNotificationPageUrl } from "./notification-action-resolver";

describe("resolveNotificationPageUrl regressions", () => {
  it("canonicalizes legacy verify-email notifications to the existing email settings page", () => {
    expect(
      resolveNotificationPageUrl({
        type: "SYSTEM",
        entityId: "VERIFY_EMAIL",
        actionUrl: "/me/settings/account",
      }),
    ).toBe("/me/settings/email");
  });

  it("opens an approved place on its public page even when the stored action points to the editor", () => {
    expect(
      resolveNotificationPageUrl({
        type: "PLACE_APPROVED",
        entityType: "PLACE",
        entityId: "place-1",
        actionUrl: "/business/places/place-1/edit",
        placeSlug: "colt",
      }),
    ).toBe("/places/colt");
  });

  it("keeps place correction notifications in the business editor", () => {
    expect(
      resolveNotificationPageUrl({
        type: "PLACE_NEEDS_CHANGES",
        entityType: "PLACE",
        entityId: "place-1",
        actionUrl: "/business/places/place-1/edit",
        placeSlug: "colt",
      }),
    ).toBe("/business/places/place-1/edit");
  });
});
