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
  website?: string | null;
  instagramHandle?: string | null;
  instagramUrl?: string | null;
  ageTags?: string[];
  visitFormats?: string[];
  activityTypes?: string[];
  placeGroupId?: string | null;
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
      website: place.website,
      instagramHandle: place.instagramHandle,
      instagramUrl: place.instagramUrl,
      ageTags: place.ageTags,
      visitFormats: place.visitFormats,
      activityTypes: place.activityTypes,
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
    moderatorComment,
    moderationReviewedAt,
    moderatedByUserId,
    revisionRequestedAt,
    revisionResubmittedAt,
    archivedAt,
    archivedByUserId,
    createdAt,
    updatedAt,
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
      Object.fromEntries(Object.entries(filteredFields).filter(([_, v]) => v !== undefined))
    );
  }

  // Update revision with only valid PlaceRevision fields
  const updatedRevision = await prisma.placeRevision.update({
    where: { id: revisionId },
    data: validData,
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
        // Delete existing revision images (we're replacing them)
        await prisma.placeRevisionImage.deleteMany({
          where: { revisionId },
        });

        // Convert temp media to PlaceRevisionImages
        const revisionImages = await Promise.all(
          tempMedia.map(async (media: TempMedia) => {
            const kind = media.kind === "PLACE_LOGO" ? "LOGO" : "GALLERY";
            
            return prisma.placeRevisionImage.create({
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

        // Update logoImageId if logo was uploaded
        const logoImage = revisionImages.find((img: PlaceRevisionImage) => img.kind === "LOGO");
        if (logoImage) {
          await prisma.placeRevision.update({
            where: { id: revisionId },
            data: { logoImageId: logoImage.id },
          });
          console.log("[PlaceRevision] Set logoImageId:", logoImage.id);
        }

        // Mark temp media as attached
        await prisma.tempMedia.updateMany({
          where: {
            ownerUserId: user.id,
            wizardSessionId,
            status: "TEMP",
          },
          data: {
            status: "ATTACHED",
            // Note: We don't set placeId here since these are attached to revision
          },
        });

        console.log(`[PlaceRevision] Attached ${revisionImages.length} images to revision`);

        // Reload revision with new images
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
  // Get revision with ownership check
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
      console.log(`[submitPlaceRevisionForModeration] Found ${tempMedia.length} temp media items to convert`);

      // Delete existing revision images (they will be replaced with temp media)
      await prisma.placeRevisionImage.deleteMany({
        where: { revisionId },
      });

      // Convert temp media to PlaceRevisionImage
      for (const media of tempMedia) {
        await prisma.placeRevisionImage.create({
          data: {
            revisionId,
            kind: media.kind === "PLACE_LOGO" ? "LOGO" : "GALLERY",
            url: media.url,
            width: media.width,
            height: media.height,
            blurhash: media.blurhash,
            sortOrder: media.sortOrder,
          },
        });
      }

      // Update revision.logoImageId if there's a logo
      const logoImage = await prisma.placeRevisionImage.findFirst({
        where: {
          revisionId,
          kind: "LOGO",
        },
      });

      if (logoImage) {
        await prisma.placeRevision.update({
          where: { id: revisionId },
          data: { logoImageId: logoImage.id },
        });
      }

      // Mark temp media as attached (or delete them)
      await prisma.tempMedia.updateMany({
        where: {
          wizardSessionId,
          status: "TEMP",
        },
        data: {
          status: "ATTACHED",
        },
      });

      console.log(`[submitPlaceRevisionForModeration] Converted ${tempMedia.length} temp media items to PlaceRevisionImage`);
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
  // Get revision
  const revision = await prisma.placeRevision.findUnique({
    where: { id: revisionId },
    include: {
      place: true,
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

  // Copy revision data to Place in a transaction
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Handle opening hours if present in revision
    let newOpeningHoursId = revision.place.openingHoursId;
    
    if (revision.openingHours) {
      // Create a copy of revision opening hours for the main place
      const { mapToCreatePayload } = await import("@/lib/openingHours");
      
      // Map revision opening hours to create payload
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
      
      // Delete old opening hours if exists
      if (revision.place.openingHoursId) {
        await tx.openingHours.delete({
          where: { id: revision.place.openingHoursId },
        });
      }

      // Create new opening hours for place
      const newOpeningHours = await tx.openingHours.create({
        data: createPayload,
      });

      newOpeningHoursId = newOpeningHours.id;
    }

    // Update Place with revision data
    await tx.place.update({
      where: { id: revision.placeId },
      data: {
        title: revision.title ?? revision.place.title,
        category: revision.category ?? revision.place.category,
        shortDesc: revision.shortDesc ?? revision.place.shortDesc,
        description: revision.description ?? revision.place.description,
        logoImageId: revision.logoImageId ?? revision.place.logoImageId,
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
        phone: revision.phone ?? revision.place.phone,
        website: revision.website ?? revision.place.website,
        instagramHandle: revision.instagramHandle ?? revision.place.instagramHandle,
        instagramUrl: revision.instagramUrl ?? revision.place.instagramUrl,
        ageTags: revision.ageTags,
        visitFormats: revision.visitFormats,
        activityTypes: revision.activityTypes,
        placeGroupId: revision.placeGroupId ?? revision.place.placeGroupId,
        openingHoursId: newOpeningHoursId, // Update opening hours
      },
    });

    // Delete old Place images and create new ones from revision
    await tx.placeImage.deleteMany({
      where: { placeId: revision.placeId },
    });

    await tx.placeImage.createMany({
      data: revision.images.map((img: PlaceRevisionImage) => ({
        placeId: revision.placeId,
        kind: img.kind,
        url: img.url,
        width: img.width,
        height: img.height,
        blurhash: img.blurhash,
        sortOrder: img.sortOrder,
      })),
    });

    // Mark revision as APPROVED
    await tx.placeRevision.update({
      where: { id: revisionId },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedByUserId: adminId,
      },
    });

    // Log moderation action
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
