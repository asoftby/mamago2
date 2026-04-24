/**
 * Place Archive Service
 * 
 * Simple and safe archive/unarchive system for Places.
 * Does NOT affect moderation status or workflow.
 */

import prisma from "@/lib/prisma";
import { getPlaceForOwner } from "./place.service";
import { detachImportedRecordsForCatalogEntity } from "@/server/modules/import/services/import-link-reconciliation.service";

/**
 * Archive a Place (soft delete)
 * 
 * Rules:
 * - Only owner or admin can archive
 * - Sets archivedAt and archivedByUserId
 * - Does NOT change status
 * - Archived places are hidden from public listings
 * 
 * SECURITY: Verifies ownership before archiving
 */
export async function archivePlace(placeId: string, userId: string) {
  // Get place and verify ownership
  // This throws if place not found or user doesn't own it
  const place = await getPlaceForOwner(placeId, userId);

  // Check if already archived
  if (place.archivedAt) {
    throw new Error("Place is already archived");
  }

  // Archive the place
  const updated = await prisma.place.update({
    where: { id: placeId },
    data: {
      archivedAt: new Date(),
      archivedByUserId: userId,
    },
  });

  await detachImportedRecordsForCatalogEntity(
    {
      entityType: "PLACE",
      entityId: placeId,
      reason: "Связанный Place заархивирован и больше не считается активной сущностью каталога.",
    },
    prisma,
  );

  console.log(`[ARCHIVE] Place ${placeId} archived by user ${userId}`);
  
  return updated;
}

/**
 * Unarchive a Place (restore)
 * 
 * Rules:
 * - Only owner or admin can unarchive
 * - Clears archivedAt and archivedByUserId
 * - Does NOT change status
 * 
 * SECURITY: Verifies ownership before unarchiving
 */
export async function unarchivePlace(placeId: string, userId: string) {
  // Get place and verify ownership
  // This throws if place not found or user doesn't own it
  const place = await getPlaceForOwner(placeId, userId);

  // Check if not archived
  if (!place.archivedAt) {
    throw new Error("Place is not archived");
  }

  // Unarchive the place
  const updated = await prisma.place.update({
    where: { id: placeId },
    data: {
      archivedAt: null,
      archivedByUserId: null,
    },
  });

  console.log(`[UNARCHIVE] Place ${placeId} unarchived by user ${userId}`);
  
  return updated;
}
