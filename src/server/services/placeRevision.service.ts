import prisma from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { PlaceRevisionStatus, LocationSource, PlaceKind, Prisma } from "@prisma/client";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";
import type { PlaceImage, PlaceRevisionImage, TempMedia, OpeningHoursRule, OpeningHoursInterval } from "../types";
import {
  notifyPlaceUpdateApproved,
  notifyPlaceUpdateNeedsRevision,
  notifyPlaceUpdateRejected,
} from "./notification.service";
import { mapToCreatePayload } from "@/lib/openingHours";
import { normalizePlacePhoneFields } from "@/lib/place/placePhones";
import { normalizeFaqItems } from "@/lib/faq/faqItems";

/**
 * Data structure for revision snapshot fields
 */
export interface PlaceRevisionData {
  title?: string;
  category?: string;
  shortDesc?: string;
  description?: string | null;
  logoImageId?: string | null;
  googlePlaceId?: string | null;
  lat?: number | null;
  lng?: number | null;
  formattedAddr?: string | null;
  addressJson?: Prisma.InputJsonValue;
  countryCode?: string | null;
  cityId?: string | null;
  locationSource?: LocationSource;
  customAddress?: string | null;
  districtAutoId?: string | null;
  districtManualId?: string | null;
  metroAutoId?: string | null;
  metroAutoDistanceM?: number | null;
  metroManualId?: string | null;
  metroManualDistanceM?: number | null;
  placeKind?: PlaceKind;
  parentPlaceId?: string | null;
  unitLabel?: string | null;
  floor?: string | null;
  unit?: string | null;
  phone?: string | null;
  phoneLabel?: string | null;
  phone2?: string | null;
  phone2Label?: string | null;
  phone3?: string | null;
  phone3Label?: string | null;
  website?: string | null;
  instagramHandle?: string | null;
  instagramUrl?: string | null;
  reelsUrl?: string | null;
  ageTags?: string[];
  visitFormats?: string[];
  activityTypes?: string[];
  placeGroupId?: string | null;
  faqItems?: Prisma.InputJsonValue;
}

// Structural type used only for fingerprinting — must be compatible with
// PlaceRevisionImage rows and with TempMedia mapped to revision-image shape.
interface RevisionImageLike {
  url: string;
  kind: string;
  sortOrder: number;
}

/**
 * Canonical fingerprint for a set of revision images.
 * Sort by (sortOrder, kind, url) so the comparison is order-independent
 * with respect to insertion order while still respecting user-visible sortOrder.
 */
function computeRevisionImageFingerprint(images: RevisionImageLike[]): string {
  return images
    .slice()
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      if (a.kind < b.kind) return -1;
      if (a.kind > b.kind) return 1;
      return a.url < b.url ? -1 : a.url > b.url ? 1 : 0;
    })
    .map((img) => `${img.sortOrder}|${img.kind}|${img.url}`)
    .join(",");
}

// Minimal structural type for opening-hours fingerprinting.
// Compatible with the Prisma-included OpeningHours + rules + intervals shape.
interface OpeningHoursLike {
  mode: string;
  timezone: string;
  note?: string | null;
  rules: Array<{
    dayOfWeek: string;
    isOpen: boolean;
    allDay: boolean;
    intervals: Array<{ startTime: string; endTime: string }>;
  }>;
}

/**
 * Canonical fingerprint for an opening-hours record (rules only, no exceptions).
 * Exceptions are intentionally excluded: the approval path does not copy them from
 * revision to place, so they must not affect whether the main schedule is rewritten.
 *
 * Only isOpen=true rules are considered — mapToCreatePayload never writes isOpen=false
 * rules, so the DB never stores them. Filtering here keeps both sides comparable.
 */
function computeOpeningHoursFingerprint(oh: OpeningHoursLike | null): string {
  if (!oh) return "";
  const rules = oh.rules
    .filter((r) => r.isOpen)
    .slice()
    .sort((a, b) => (a.dayOfWeek < b.dayOfWeek ? -1 : a.dayOfWeek > b.dayOfWeek ? 1 : 0))
    .map((r) => {
      const ivs = r.allDay
        ? "allDay"
        : r.intervals.map((i) => `${i.startTime}~${i.endTime}`).join("+");
      return `${r.dayOfWeek}:${ivs}`;
    })
    .join("|");
  return `${oh.mode}!${oh.timezone}!${oh.note ?? ""}!${rules}`;
}

/**
 * Get active revision for a Place (DRAFT, PENDING, or NEEDS_REVISION)
 * Returns null if no active revision exists
 */
export async function getActiveRevision(placeId: string) {
  return prisma.placeRevision.findFirst({
    where: {
      placeId,
      status: {
        in: ["DRAFT", "PENDING", "NEEDS_REVISION"],
      },
    },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

/**
 * Check if Place has an active revision
 */
export async function hasActiveRevision(placeId: string): Promise<boolean> {
  const count = await prisma.placeRevision.count({
    where: {
      placeId,
      status: {
        in: ["DRAFT", "PENDING", "NEEDS_REVISION"],
      },
    },
  });
  return count > 0;
}

/**
 * Get or create active revision for a published Place
 * Enforces one-active-revision rule
 * Creates snapshot from current Place data if no active revision exists
 */
export async function getOrCreatePlaceRevision(
  placeId: string,
  user: { id: string; role: Role }
) {
  // Get the Place with ownership check
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!place) {
    throw new Error("Place not found");
  }

  const canManage = await canManagePlaceAsync(user, place);
  if (!canManage) {
    throw new Error("Unauthorized: not place owner");
  }

  if (place.status !== "PUBLISHED") {
    throw new Error("Can only create revisions for published Places");
  }

  // Check for existing active revision
  const existingRevision = await getActiveRevision(placeId);
  if (existingRevision) {
    return existingRevision;
  }

  // Create new revision from current Place data
  const revision = await prisma.placeRevision.create({
    data: {
      placeId,
      status: "DRAFT",
      // Snapshot current Place data
      title: place.title,
      category: place.category,
      shortDesc: place.shortDesc,
      description: place.description,
      logoImageId: place.logoImageId,
      googlePlaceId: place.googlePlaceId,
      lat: place.lat,
      lng: place.lng,
      formattedAddr: place.formattedAddr,
      addressJson: place.addressJson as Prisma.InputJsonValue,
      countryCode: place.countryCode,
      cityId: place.cityId,
      locationSource: place.locationSource,
      customAddress: place.customAddress,
      districtAutoId: place.districtAutoId,
      districtManualId: place.districtManualId,
      metroAutoId: place.metroAutoId,
      metroAutoDistanceM: place.metroAutoDistanceM,
      metroManualId: place.metroManualId,
      metroManualDistanceM: place.metroManualDistanceM,
      placeKind: place.placeKind,
      parentPlaceId: place.parentPlaceId,
      unitLabel: place.unitLabel,
      floor: place.floor,
      unit: place.unit,
      phone: place.phone,
      phoneLabel: place.phoneLabel,
      phone2: place.phone2,
      phone2Label: place.phone2Label,
      phone3: place.phone3,
      phone3Label: place.phone3Label,
      website: place.website,
      instagramHandle: place.instagramHandle,
      instagramUrl: place.instagramUrl,
      reelsUrl: place.reelsUrl,
      ageTags: place.ageTags,
      visitFormats: place.visitFormats,
      activityTypes: place.activityTypes,
      faqItems: place.faqItems as Prisma.InputJsonValue,
      placeGroupId: place.placeGroupId,
      // Copy images
      images: {
        create: place.images.map((img: PlaceImage) => ({
          kind: img.kind,
          url: img.url,
          width: img.width,
          height: img.height,
          blurhash: img.blurhash,
          sortOrder: img.sortOrder,
        })),
      },
    },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return revision;
}

/**
 * Save revision draft (update fields)
 * Only allowed for DRAFT or NEEDS_REVISION status
 */
export async function savePlaceRevisionDraft(
  revisionId: string,
  data: PlaceRevisionData & { wizardSessionId?: string },
  user: { id: string; role: Role }
) {
  // Get revision with ownership check
  const revision = await prisma.placeRevision.findUnique({
    where: { id: revisionId },
    include: {
      place: {
        select: {
          createdByUserId: true,
          ownerBusinessId: true,
        },
      },
    },
  });

  if (!revision) {
    throw new Error("Revision not found");
  }

  const canManage = await canManagePlaceAsync(user, revision.place);
  if (!canManage) {
    throw new Error("Unauthorized: not place owner");
  }

  if (revision.status !== "DRAFT" && revision.status !== "NEEDS_REVISION") {
    throw new Error(
      `Cannot edit revision with status: ${revision.status}. Only DRAFT and NEEDS_REVISION can be edited.`
    );
  }

  // Extract wizardSessionId if provided
  const { wizardSessionId, ...revisionData } = data;
  const hasPhoneFieldUpdates =
    revisionData.phone !== undefined ||
    revisionData.phoneLabel !== undefined ||
    revisionData.phone2 !== undefined ||
    revisionData.phone2Label !== undefined ||
    revisionData.phone3 !== undefined ||
    revisionData.phone3Label !== undefined;
  const normalizedPhoneFields = hasPhoneFieldUpdates
    ? normalizePlacePhoneFields({
        phone: revisionData.phone !== undefined ? revisionData.phone : revision.phone,
        phoneLabel:
          revisionData.phoneLabel !== undefined ? revisionData.phoneLabel : revision.phoneLabel,
        phone2: revisionData.phone2 !== undefined ? revisionData.phone2 : revision.phone2,
        phone2Label:
          revisionData.phone2Label !== undefined
            ? revisionData.phone2Label
            : revision.phone2Label,
        phone3: revisionData.phone3 !== undefined ? revisionData.phone3 : revision.phone3,
        phone3Label:
          revisionData.phone3Label !== undefined
            ? revisionData.phone3Label
            : revision.phone3Label,
      })
    : null;
  const normalizedFaqItems =
    revisionData.faqItems !== undefined ? normalizeFaqItems(revisionData.faqItems) : undefined;

  // Filter out fields that don't exist in PlaceRevision model
  // PlaceRevision uses logoImageId, not logoMediaId
  // PlaceRevision doesn't have galleryMediaIds, galleryUrls, or other temp media fields
  type RevisionDataExtended = PlaceRevisionData & {
    logoMediaId?: unknown;
    logoUrl?: unknown;
    galleryMediaIds?: unknown;
    galleryUrls?: unknown;
    ownerBusinessId?: unknown;
    status?: unknown;
    createRequestId?: unknown;
    moderatorComment?: unknown;
    moderationReviewedAt?: unknown;
    moderatedByUserId?: unknown;
    revisionRequestedAt?: unknown;
    revisionResubmittedAt?: unknown;
    archivedAt?: unknown;
    archivedByUserId?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
    images?: unknown[];
  };
  const {
    // Remove temp media fields (used in wizard but not in revision model)
    logoMediaId,
    logoUrl,
    galleryMediaIds,
    galleryUrls,
    // Remove any other fields that might come from Place but don't exist in PlaceRevision
    ownerBusinessId,
    status,
    createRequestId,
    // Remove relation fields that shouldn't be in data
    images,
    ...validData
  } = revisionData as RevisionDataExtended;

  // Log what we're filtering out for debugging
  const filteredFields = {
    logoMediaId,
    logoUrl,
    galleryMediaIds,
    galleryUrls,
    ownerBusinessId,
    status,
    createRequestId,
    images: images ? `${images.length} images` : undefined,
  };
  const hasFilteredFields = Object.values(filteredFields).some(v => v !== undefined);
  if (hasFilteredFields) {
    console.log("[PlaceRevision] Filtered out invalid fields:", 
      Object.fromEntries(Object.entries(filteredFields).filter(([, v]) => v !== undefined))
    );
  }

  // Filter out null values from validData (Prisma expects undefined for optional fields)
  const validDataFiltered = Object.fromEntries(
    Object.entries({
      ...validData,
      ...(normalizedPhoneFields ?? {}),
      ...(normalizedFaqItems !== undefined
        ? { faqItems: normalizedFaqItems as unknown as Prisma.InputJsonValue }
        : {}),
    }).filter(([, v]) => v !== undefined)
  ) as Prisma.AtLeast<Prisma.PlaceRevisionUpdateInput, 'id'>;

  // Update revision with only valid PlaceRevision fields
  const updatedRevision = await prisma.placeRevision.update({
    where: { id: revisionId },
    data: validDataFiltered,
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  // Attach temp media if wizardSessionId provided
  if (wizardSessionId) {
    console.log("[PlaceRevision] Attaching temp media from session:", wizardSessionId);
    
    try {
      // Get all temp media for this session
      const tempMedia = await prisma.tempMedia.findMany({
        where: {
          ownerUserId: user.id,
          wizardSessionId,
          status: "TEMP",
        },
        orderBy: [
          { kind: "asc" },
          { sortOrder: "asc" },
        ],
      });

      console.log(`[PlaceRevision] Found ${tempMedia.length} temp media items`);

      if (tempMedia.length > 0) {
        const incomingFingerprint = computeRevisionImageFingerprint(
          tempMedia.map((m: TempMedia) => ({
            url: m.url,
            kind: m.kind === "PLACE_LOGO" ? "LOGO" : "GALLERY",
            sortOrder: m.sortOrder,
          }))
        );
        const currentFingerprint = computeRevisionImageFingerprint(updatedRevision.images);

        if (incomingFingerprint === currentFingerprint) {
          // Images unchanged — skip deleteMany/create, only mark temp media attached.
          console.log("[PlaceRevision] Images unchanged, skipping replacement");
          await prisma.tempMedia.updateMany({
            where: { ownerUserId: user.id, wizardSessionId, status: "TEMP" },
            data: { status: "ATTACHED" },
          });
        } else {
          // Images changed — replace atomically so a crash cannot leave revision image-less.
          const revisionImages = await prisma.$transaction(async (tx) => {
            await tx.placeRevisionImage.deleteMany({ where: { revisionId } });

            const images = await Promise.all(
              tempMedia.map((media: TempMedia) => {
                const kind = media.kind === "PLACE_LOGO" ? "LOGO" : "GALLERY";
                return tx.placeRevisionImage.create({
                  data: {
                    revisionId,
                    kind,
                    url: media.url,
                    width: media.width,
                    height: media.height,
                    blurhash: media.blurhash,
                    sortOrder: media.sortOrder,
                  },
                });
              })
            );

            const logoImage = images.find((img) => img.kind === "LOGO");
            if (logoImage) {
              await tx.placeRevision.update({
                where: { id: revisionId },
                data: { logoImageId: logoImage.id },
              });
              console.log("[PlaceRevision] Set logoImageId:", logoImage.id);
            }

            await tx.tempMedia.updateMany({
              where: { ownerUserId: user.id, wizardSessionId, status: "TEMP" },
              data: { status: "ATTACHED" },
            });

            return images;
          });

          console.log(`[PlaceRevision] Attached ${revisionImages.length} images to revision`);
        }

        // Reload revision with updated images
        return prisma.placeRevision.findUnique({
          where: { id: revisionId },
          include: {
            images: {
              orderBy: { sortOrder: "asc" },
            },
          },
        });
      }
    } catch (attachError) {
      console.error("[PlaceRevision] Failed to attach temp media (non-fatal):", attachError);
      // Continue - revision is saved, images can be uploaded later
    }
  }

  return updatedRevision;
}

/**
 * Submit revision for moderation
 * Changes status from DRAFT or NEEDS_REVISION to PENDING
 * Automatically links to active improvement requests if any exist
 */
export async function submitPlaceRevisionForModeration(
  revisionId: string,
  user: { id: string; role: Role },
  wizardSessionId?: string
) {
  // Get revision with ownership check; images loaded here to enable fingerprint guard below.
  const revision = await prisma.placeRevision.findUnique({
    where: { id: revisionId },
    include: {
      place: {
        select: {
          id: true,
          createdByUserId: true,
          ownerBusinessId: true,
        },
      },
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!revision) {
    throw new Error("Revision not found");
  }

  const canManage = await canManagePlaceAsync(user, revision.place);
  if (!canManage) {
    throw new Error("Unauthorized: not place owner");
  }

  if (revision.status !== "DRAFT" && revision.status !== "NEEDS_REVISION") {
    throw new Error(
      `Cannot submit revision from status: ${revision.status}`
    );
  }

  // Check for THE active improvement request for this place (only one can exist)
  const activeImprovementRequest = await prisma.improvementRequest.findFirst({
    where: {
      entityType: "PLACE",
      entityId: revision.place.id,
      status: {
        in: ["OPEN", "IN_PROGRESS"],
      },
    },
    orderBy: {
      createdAt: "desc", // Safety: get most recent if legacy data has multiple
    },
  });

  // Convert temp media to PlaceRevisionImage if wizardSessionId provided
  if (wizardSessionId) {
    // Get temp media for this session
    const tempMedia = await prisma.tempMedia.findMany({
      where: {
        wizardSessionId,
        status: "TEMP", // Only get temp media that hasn't been attached yet
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    if (tempMedia.length > 0) {
      const incomingFingerprint = computeRevisionImageFingerprint(
        tempMedia.map((m) => ({
          url: m.url,
          kind: m.kind === "PLACE_LOGO" ? "LOGO" : "GALLERY",
          sortOrder: m.sortOrder,
        }))
      );
      const currentFingerprint = computeRevisionImageFingerprint(revision.images);

      if (incomingFingerprint === currentFingerprint) {
        // Images unchanged — skip deleteMany/create, only mark temp media attached.
        console.log("[submitPlaceRevisionForModeration] Images unchanged, skipping replacement");
        await prisma.tempMedia.updateMany({
          where: { wizardSessionId, status: "TEMP" },
          data: { status: "ATTACHED" },
        });
      } else {
        // Images changed — replace atomically to prevent partial-state on crash.
        console.log(`[submitPlaceRevisionForModeration] Replacing ${tempMedia.length} images`);
        await prisma.$transaction(async (tx) => {
          await tx.placeRevisionImage.deleteMany({ where: { revisionId } });

          const images = await Promise.all(
            tempMedia.map((media) => {
              const kind = media.kind === "PLACE_LOGO" ? "LOGO" : "GALLERY";
              return tx.placeRevisionImage.create({
                data: {
                  revisionId,
                  kind,
                  url: media.url,
                  width: media.width,
                  height: media.height,
                  blurhash: media.blurhash,
                  sortOrder: media.sortOrder,
                },
              });
            })
          );

          const logoImage = images.find((img) => img.kind === "LOGO");
          if (logoImage) {
            await tx.placeRevision.update({
              where: { id: revisionId },
              data: { logoImageId: logoImage.id },
            });
          }

          await tx.tempMedia.updateMany({
            where: { wizardSessionId, status: "TEMP" },
            data: { status: "ATTACHED" },
          });
        });

        console.log(`[submitPlaceRevisionForModeration] Replaced ${tempMedia.length} images`);
      }
    }
  }

  // Prepare update data
  const updateData: Prisma.PlaceRevisionUpdateInput = {
    status: "PENDING" as PlaceRevisionStatus,
    submittedAt: new Date(),
  };

  // If resubmitting after NEEDS_REVISION, set revisionResubmittedAt
  if (revision.status === "NEEDS_REVISION") {
    updateData.revisionResubmittedAt = new Date();
  }

  // Link to improvement request if one exists
  if (activeImprovementRequest) {
    updateData.improvementRequestId = activeImprovementRequest.id;
  }

  // Update revision and improvement request in a transaction
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Update revision
    const updatedRevision = await tx.placeRevision.update({
      where: { id: revisionId },
      data: updateData,
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    // Update improvement request status to IN_PROGRESS if linked
    if (activeImprovementRequest) {
      await tx.improvementRequest.update({
        where: { id: activeImprovementRequest.id },
        data: { status: "IN_PROGRESS" },
      });
    }

    return updatedRevision;
  });
}

/**
 * Approve revision
 * Copies revision data into Place and marks revision as APPROVED
 */
export async function approvePlaceRevision(
  revisionId: string,
  adminId: string
) {
  // Get revision; place.images and place.openingHours loaded here to enable
  // fingerprint guards for both images (Phase 6F-2) and opening hours (Phase 6F-3).
  const revision = await prisma.placeRevision.findUnique({
    where: { id: revisionId },
    include: {
      place: {
        include: {
          images: {
            orderBy: { sortOrder: "asc" },
          },
          openingHours: {
            include: {
              rules: {
                include: {
                  intervals: {
                    orderBy: { sortOrder: "asc" },
                  },
                },
              },
            },
          },
        },
      },
      images: {
        orderBy: { sortOrder: "asc" },
      },
      openingHours: {
        include: {
          rules: {
            include: {
              intervals: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          exceptions: {
            include: {
              intervals: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!revision) {
    throw new Error("Revision not found");
  }

  if (revision.status !== "PENDING") {
    throw new Error(`Cannot approve revision from status: ${revision.status}`);
  }

  // Copy revision data to Place in a transaction.
  // Image handling runs BEFORE place.update so that approvedLogoImageId is resolved
  // in PlaceImage.id space before being written to place.logoImageId.
  //
  // Id-space note:
  //   Place.logoImageId          must reference a PlaceImage.id
  //   PlaceRevision.logoImageId  references a PlaceRevisionImage.id (after media upload)
  //                              or a PlaceImage.id (snapshot copy from place, no upload)
  // Approval must translate revision.logoImageId → the correct PlaceImage.id.
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // ── Opening hours ───────────────────────────────────────────────────────────
    // Skip delete+create when revision opening hours are identical to current place
    // opening hours (fingerprint comparison in memory — no extra DB reads).
    // Exceptions are intentionally not copied from revision to place (pre-existing
    // behaviour) and are excluded from the fingerprint for that reason.
    let newOpeningHoursId = revision.place.openingHoursId;

    if (revision.openingHours) {
      const revisionOhFingerprint = computeOpeningHoursFingerprint(revision.openingHours);
      const placeOhFingerprint    = computeOpeningHoursFingerprint(revision.place.openingHours ?? null);

      if (revisionOhFingerprint !== placeOhFingerprint) {
        // Opening hours changed — replace the place's opening hours record.
        const openingHoursData = {
          mode: revision.openingHours.mode,
          timezone: revision.openingHours.timezone,
          note: revision.openingHours.note || undefined,
          rules: revision.openingHours.rules.map((rule: OpeningHoursRule & { intervals: OpeningHoursInterval[] }) => ({
            dayOfWeek: rule.dayOfWeek,
            isOpen: rule.isOpen,
            allDay: rule.allDay,
            intervals: rule.intervals.map((interval: OpeningHoursInterval) => ({
              startTime: interval.startTime,
              endTime: interval.endTime,
            })),
          })),
        };

        const createPayload = mapToCreatePayload(openingHoursData);

        if (revision.place.openingHoursId) {
          await tx.openingHours.delete({
            where: { id: revision.place.openingHoursId },
          });
        }

        const newOpeningHours = await tx.openingHours.create({
          data: createPayload,
        });

        newOpeningHoursId = newOpeningHours.id;
      }
      // else: opening hours unchanged — keep revision.place.openingHoursId as-is.
    }

    // ── Images + logoImageId resolution ────────────────────────────────────────
    // Fingerprints are computed from pre-loaded in-memory data — no extra DB reads.
    const placeImageFingerprint    = computeRevisionImageFingerprint(revision.place.images);
    const revisionImageFingerprint = computeRevisionImageFingerprint(revision.images);
    const imagesChanged = placeImageFingerprint !== revisionImageFingerprint;

    // Resolve the PlaceImage.id to store in place.logoImageId.
    // revision.logoImageId may be a PlaceRevisionImage.id (after media upload) or a
    // PlaceImage.id (snapshot with no subsequent upload). Either way we must end up
    // with a valid PlaceImage.id — resolved by URL match against the live image set.
    let approvedLogoImageId: string | null;

    if (!imagesChanged) {
      // Existing PlaceImage rows are kept unchanged.
      // Find the logo by matching URL against the current place image set.
      const revLogoImg = revision.images.find((img) => img.kind === "LOGO");
      if (revLogoImg) {
        const placeLogoImg = revision.place.images.find(
          (img) => img.kind === "LOGO" && img.url === revLogoImg.url
        );
        // Fall back to existing place.logoImageId if URL match fails (defensive).
        approvedLogoImageId = placeLogoImg?.id ?? revision.place.logoImageId;
      } else {
        // Revision carries no logo image — clear the logo on the place.
        approvedLogoImageId = null;
      }
    } else {
      // Images changed — delete old PlaceImages and create new ones.
      // LOGO is created individually (not via createMany) so its new PlaceImage.id
      // is available in memory without an extra findFirst round-trip.
      await tx.placeImage.deleteMany({ where: { placeId: revision.placeId } });

      const logoRevImg     = revision.images.find((img: PlaceRevisionImage) => img.kind === "LOGO");
      const galleryRevImgs = revision.images.filter((img: PlaceRevisionImage) => img.kind !== "LOGO");

      let newLogoPlaceImg: { id: string } | null = null;
      if (logoRevImg) {
        newLogoPlaceImg = await tx.placeImage.create({
          data: {
            placeId: revision.placeId,
            kind: logoRevImg.kind,
            url: logoRevImg.url,
            width: logoRevImg.width,
            height: logoRevImg.height,
            blurhash: logoRevImg.blurhash,
            sortOrder: logoRevImg.sortOrder,
          },
          select: { id: true },
        });
      }

      if (galleryRevImgs.length > 0) {
        await tx.placeImage.createMany({
          data: galleryRevImgs.map((img: PlaceRevisionImage) => ({
            placeId: revision.placeId,
            kind: img.kind,
            url: img.url,
            width: img.width,
            height: img.height,
            blurhash: img.blurhash,
            sortOrder: img.sortOrder,
          })),
        });
      }

      approvedLogoImageId = newLogoPlaceImg?.id ?? null;
    }

    // ── Place scalar fields ─────────────────────────────────────────────────────
    await tx.place.update({
      where: { id: revision.placeId },
      data: {
        title: revision.title ?? revision.place.title,
        category: revision.category ?? revision.place.category,
        shortDesc: revision.shortDesc ?? revision.place.shortDesc,
        description: revision.description ?? revision.place.description,
        // approvedLogoImageId is a PlaceImage.id resolved above — never a PlaceRevisionImage.id.
        logoImageId: approvedLogoImageId,
        googlePlaceId: revision.googlePlaceId ?? revision.place.googlePlaceId,
        lat: revision.lat ?? revision.place.lat,
        lng: revision.lng ?? revision.place.lng,
        formattedAddr: revision.formattedAddr ?? revision.place.formattedAddr,
        addressJson: (revision.addressJson ?? revision.place.addressJson) as Prisma.InputJsonValue,
        countryCode: revision.countryCode ?? revision.place.countryCode,
        cityId: revision.cityId ?? revision.place.cityId,
        locationSource: revision.locationSource ?? revision.place.locationSource,
        customAddress: revision.customAddress ?? revision.place.customAddress,
        districtAutoId: revision.districtAutoId ?? revision.place.districtAutoId,
        districtManualId: revision.districtManualId ?? revision.place.districtManualId,
        metroAutoId: revision.metroAutoId ?? revision.place.metroAutoId,
        metroAutoDistanceM: revision.metroAutoDistanceM ?? revision.place.metroAutoDistanceM,
        metroManualId: revision.metroManualId ?? revision.place.metroManualId,
        metroManualDistanceM: revision.metroManualDistanceM ?? revision.place.metroManualDistanceM,
        placeKind: revision.placeKind ?? revision.place.placeKind,
        parentPlaceId: revision.parentPlaceId ?? revision.place.parentPlaceId,
        unitLabel: revision.unitLabel ?? revision.place.unitLabel,
        floor: revision.floor ?? revision.place.floor,
        unit: revision.unit ?? revision.place.unit,
        phone: revision.phone,
        phoneLabel: revision.phone ? revision.phoneLabel : null,
        phone2: revision.phone2,
        phone2Label: revision.phone2 ? revision.phone2Label : null,
        phone3: revision.phone3,
        phone3Label: revision.phone3 ? revision.phone3Label : null,
        website: revision.website ?? revision.place.website,
        instagramHandle: revision.instagramHandle ?? revision.place.instagramHandle,
        instagramUrl: revision.instagramUrl ?? revision.place.instagramUrl,
        reelsUrl: revision.reelsUrl ?? revision.place.reelsUrl,
        ageTags: revision.ageTags,
        visitFormats: revision.visitFormats,
        activityTypes: revision.activityTypes,
        placeGroupId: revision.placeGroupId ?? revision.place.placeGroupId,
        openingHoursId: newOpeningHoursId,
      },
    });

    // ── Revision status + audit log ────────────────────────────────────────────
    await tx.placeRevision.update({
      where: { id: revisionId },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedByUserId: adminId,
      },
    });

    await tx.moderationLog.create({
      data: {
        entityType: "PLACE",
        entityId: revision.placeId,
        action: "APPROVE",
        message: "Place revision approved",
        reviewedByUserId: adminId,
      },
    });
  });

  // Create notification (outside transaction for resilience)
  try {
    if (revision.place.ownerBusinessId) {
      await notifyPlaceUpdateApproved(
        revision.placeId,
        revision.title ?? revision.place.title,
        revision.place.ownerBusinessId
      );
    }
  } catch (notificationError) {
    console.error("Failed to create notification:", notificationError);
    // Don't fail the approval if notification fails
  }

  // Auto-resolve improvement request if this revision was linked to one
  if (revision.improvementRequestId) {
    try {
      const { resolveImprovementRequest } = await import("./improvementRequest.service");
      await resolveImprovementRequest(revision.improvementRequestId, revisionId);
      console.log(`[PlaceRevision] Auto-resolved improvement request: ${revision.improvementRequestId}`);
    } catch (improvementError) {
      console.error("Failed to auto-resolve improvement request:", improvementError);
      // Don't fail the approval if improvement request resolution fails
    }
  }
}

/**
 * Request changes for revision
 * Changes status from PENDING to NEEDS_REVISION
 */
export async function requestPlaceRevisionChanges(
  revisionId: string,
  adminId: string,
  comment: string
) {
  if (!comment || comment.trim().length === 0) {
    throw new Error("Comment is required when requesting changes");
  }

  // Get revision
  const revision = await prisma.placeRevision.findUnique({
    where: { id: revisionId },
  });

  if (!revision) {
    throw new Error("Revision not found");
  }

  if (revision.status !== "PENDING") {
    throw new Error(
      `Cannot request changes from status: ${revision.status}`
    );
  }

  // Update revision
  await prisma.$transaction([
    prisma.placeRevision.update({
      where: { id: revisionId },
      data: {
        status: "NEEDS_REVISION",
        moderatorComment: comment,
        reviewedAt: new Date(),
        reviewedByUserId: adminId,
        revisionRequestedAt: new Date(),
      },
    }),

    // Log moderation action
    prisma.moderationLog.create({
      data: {
        entityType: "PLACE",
        entityId: revision.placeId,
        action: "NEEDS_REVISION",
        message: comment,
        reviewedByUserId: adminId,
      },
    }),
  ]);

  // Get Place for notification
  const place = await prisma.place.findUnique({
    where: { id: revision.placeId },
    select: {
      title: true,
      ownerBusinessId: true,
    },
  });

  // Create notification (outside transaction for resilience)
  if (place) {
    try {
      if (place.ownerBusinessId) {
        await notifyPlaceUpdateNeedsRevision(
          revision.placeId,
          revision.title ?? place.title,
          place.ownerBusinessId,
          comment
        );
      }
    } catch (notificationError) {
      console.error("Failed to create notification:", notificationError);
      // Don't fail the moderation if notification fails
    }
  }
}

/**
 * Reject revision
 * Changes status from PENDING to REJECTED
 */
export async function rejectPlaceRevision(
  revisionId: string,
  adminId: string,
  comment: string
) {
  if (!comment || comment.trim().length === 0) {
    throw new Error("Comment is required when rejecting revision");
  }

  // Get revision
  const revision = await prisma.placeRevision.findUnique({
    where: { id: revisionId },
  });

  if (!revision) {
    throw new Error("Revision not found");
  }

  if (revision.status !== "PENDING") {
    throw new Error(`Cannot reject revision from status: ${revision.status}`);
  }

  // Update revision
  await prisma.$transaction([
    prisma.placeRevision.update({
      where: { id: revisionId },
      data: {
        status: "REJECTED",
        moderatorComment: comment,
        reviewedAt: new Date(),
        reviewedByUserId: adminId,
      },
    }),

    // Log moderation action
    prisma.moderationLog.create({
      data: {
        entityType: "PLACE",
        entityId: revision.placeId,
        action: "REJECT",
        message: comment,
        reviewedByUserId: adminId,
      },
    }),
  ]);

  // Get Place for notification
  const place = await prisma.place.findUnique({
    where: { id: revision.placeId },
    select: {
      title: true,
      ownerBusinessId: true,
    },
  });

  // Create notification (outside transaction for resilience)
  if (place) {
    try {
      if (place.ownerBusinessId) {
        await notifyPlaceUpdateRejected(
          revision.placeId,
          revision.title ?? place.title,
          place.ownerBusinessId,
          comment
        );
      }
    } catch (notificationError) {
      console.error("Failed to create notification:", notificationError);
      // Don't fail the moderation if notification fails
    }
  }
}

/**
 * Get expired revisions (NEEDS_REVISION for more than specified days)
 * Used for admin filtering and follow-up
 */
export async function getExpiredRevisions(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return prisma.placeRevision.findMany({
    where: {
      status: "NEEDS_REVISION",
      revisionRequestedAt: {
        lt: cutoffDate,
      },
    },
    include: {
      place: {
        select: {
          id: true,
          title: true,
          city: {
            select: {
              name: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              email: true,
              business: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      revisionRequestedAt: "asc",
    },
  });
}

/**
 * Calculate days since revision was requested
 */
export function calculateDaysSinceRevisionRequest(revisionRequestedAt: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - revisionRequestedAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
