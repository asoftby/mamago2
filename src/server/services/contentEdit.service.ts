import { prisma } from "@/lib/prisma";
import { ContentEditType } from "@prisma/client";

// Fields that cannot be micro-edited (protected fields)
const PROTECTED_FIELDS = new Set([
  "lat",
  "lng",
  "googlePlaceId",
  "formattedAddr",
  "addressJson",
  "countryCode",
  "cityId",
  "category",
  "ageTags",
  "logoImageId",
  "images",
]);

interface ApplyMicroEditParams {
  entityType: string;
  entityId: string;
  moderatorId: string;
  fieldName: string;
  newValue: string;
  editType: ContentEditType;
  comment?: string;
}

/**
 * Validate if a field can be micro-edited
 */
export function validateMicroEditableField(fieldName: string): boolean {
  return !PROTECTED_FIELDS.has(fieldName);
}

/**
 * Apply a micro-edit to an entity and log it
 */
export async function applyMicroEdit(params: ApplyMicroEditParams) {
  const { entityType, entityId, moderatorId, fieldName, newValue, editType, comment } = params;

  // Validate field is editable
  if (!validateMicroEditableField(fieldName)) {
    throw new Error(`Field "${fieldName}" cannot be micro-edited (protected field)`);
  }

  // Get current entity value
  let entity: any;
  let oldValue: string | null = null;

  if (entityType === "PLACE") {
    entity = await prisma.place.findUnique({
      where: { id: entityId },
      select: { [fieldName]: true },
    });
    if (!entity) {
      throw new Error("Place not found");
    }
    oldValue = entity[fieldName] || null;

    // Apply the edit
    await prisma.place.update({
      where: { id: entityId },
      data: { [fieldName]: newValue },
    });
  } else {
    throw new Error(`Entity type "${entityType}" not supported for micro-edits`);
  }

  // Log the edit
  const log = await prisma.contentEditLog.create({
    data: {
      entityType,
      entityId,
      moderatorId,
      fieldName,
      oldValue,
      newValue,
      editType,
      comment,
    },
    include: {
      moderator: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });

  return log;
}

/**
 * List micro-edits for an entity
 */
export async function listMicroEditsForEntity(entityType: string, entityId: string) {
  const edits = await prisma.contentEditLog.findMany({
    where: {
      entityType,
      entityId,
    },
    include: {
      moderator: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return edits;
}

/**
 * List recent micro-edits by a moderator
 */
export async function listMicroEditsByModerator(moderatorId: string, limit = 50) {
  const edits = await prisma.contentEditLog.findMany({
    where: {
      moderatorId,
    },
    include: {
      moderator: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return edits;
}
