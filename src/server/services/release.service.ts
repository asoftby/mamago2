import { Prisma, ReleaseNoteType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CreateReleaseInput,
  ReleaseListItem,
  UpdateReleaseInput,
} from "@/types/release";

export type ReleaseServiceErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE_VERSION"
  | "CANNOT_DELETE_PUBLISHED"
  | "CURRENT_MUST_BE_PUBLISHED";

export class ReleaseServiceError extends Error {
  constructor(
    message: string,
    public readonly code: ReleaseServiceErrorCode,
  ) {
    super(message);
    this.name = "ReleaseServiceError";
  }
}

const releaseInclude = {
  notes: {
    orderBy: [{ order: "asc" as const }, { createdAt: "asc" as const }],
  },
} satisfies Prisma.ReleaseInclude;

type ReleaseWithNotes = Prisma.ReleaseGetPayload<{
  include: typeof releaseInclude;
}>;

function mapNotesForCreate(
  notes: CreateReleaseInput["notes"],
): Prisma.ReleaseNoteCreateWithoutReleaseInput[] {
  return notes.map((note, index) => ({
    type: note.type as ReleaseNoteType,
    title: note.title,
    description: note.description ?? null,
    order: index,
  }));
}

export function serializeRelease(release: ReleaseWithNotes): ReleaseListItem {
  return {
    id: release.id,
    version: release.version,
    title: release.title,
    description: release.description,
    status: release.status,
    isCurrent: release.isCurrent,
    releasedAt: release.releasedAt?.toISOString() ?? null,
    createdAt: release.createdAt.toISOString(),
    updatedAt: release.updatedAt.toISOString(),
    notes: release.notes.map((note) => ({
      id: note.id,
      type: note.type,
      title: note.title,
      description: note.description,
      order: note.order,
    })),
  };
}

function isDuplicateVersionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function getReleaseOrThrow(id: string): Promise<ReleaseWithNotes> {
  const release = await prisma.release.findUnique({
    where: { id },
    include: releaseInclude,
  });

  if (!release) {
    throw new ReleaseServiceError("Релиз не найден", "NOT_FOUND");
  }

  return release;
}

export async function listReleases(): Promise<ReleaseListItem[]> {
  const releases = await prisma.release.findMany({
    include: releaseInclude,
    orderBy: [
      { isCurrent: "desc" },
      { releasedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  });

  return releases.map(serializeRelease);
}

export async function getReleaseById(id: string): Promise<ReleaseListItem> {
  const release = await getReleaseOrThrow(id);
  return serializeRelease(release);
}

export async function createRelease(
  input: CreateReleaseInput,
): Promise<ReleaseListItem> {
  try {
    const release = await prisma.release.create({
      data: {
        version: input.version,
        title: input.title,
        status: "DRAFT",
        notes: {
          create: mapNotesForCreate(input.notes),
        },
      },
      include: releaseInclude,
    });

    return serializeRelease(release);
  } catch (error) {
    if (isDuplicateVersionError(error)) {
      throw new ReleaseServiceError(
        "Версия с таким номером уже существует",
        "DUPLICATE_VERSION",
      );
    }
    throw error;
  }
}

export async function updateRelease(
  id: string,
  input: UpdateReleaseInput,
): Promise<ReleaseListItem> {
  const existing = await getReleaseOrThrow(id);

  const data: Prisma.ReleaseUpdateInput = {};

  if (input.version !== undefined) data.version = input.version;
  if (input.title !== undefined) data.title = input.title;

  try {
    const release = await prisma.$transaction(async (tx) => {
      if (input.notes !== undefined) {
        await tx.releaseNote.deleteMany({ where: { releaseId: id } });
        data.notes = {
          create: mapNotesForCreate(input.notes),
        };
      }

      return tx.release.update({
        where: { id: existing.id },
        data,
        include: releaseInclude,
      });
    });

    return serializeRelease(release);
  } catch (error) {
    if (isDuplicateVersionError(error)) {
      throw new ReleaseServiceError(
        "Версия с таким номером уже существует",
        "DUPLICATE_VERSION",
      );
    }
    throw error;
  }
}

export async function publishRelease(id: string): Promise<ReleaseListItem> {
  await getReleaseOrThrow(id);

  const release = await prisma.$transaction(async (tx) => {
    const current = await tx.release.findUnique({ where: { id } });
    if (!current) {
      throw new ReleaseServiceError("Релиз не найден", "NOT_FOUND");
    }

    await tx.release.updateMany({
      data: { isCurrent: false },
    });

    return tx.release.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        releasedAt: current.releasedAt ?? new Date(),
        isCurrent: true,
      },
      include: releaseInclude,
    });
  });

  return serializeRelease(release);
}

export async function setCurrentRelease(id: string): Promise<ReleaseListItem> {
  const existing = await getReleaseOrThrow(id);

  if (existing.status !== "PUBLISHED") {
    throw new ReleaseServiceError(
      "Текущей может быть только опубликованная версия",
      "CURRENT_MUST_BE_PUBLISHED",
    );
  }

  const release = await prisma.$transaction(async (tx) => {
    await tx.release.updateMany({
      data: { isCurrent: false },
    });

    return tx.release.update({
      where: { id },
      data: { isCurrent: true },
      include: releaseInclude,
    });
  });

  return serializeRelease(release);
}

export async function deleteRelease(id: string): Promise<void> {
  const existing = await getReleaseOrThrow(id);

  if (existing.status !== "DRAFT") {
    throw new ReleaseServiceError(
      "Опубликованную версию удалить нельзя",
      "CANNOT_DELETE_PUBLISHED",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.release.delete({ where: { id } });

    // Defensive: if the deleted release was somehow isCurrent, promote the next published release
    if (existing.isCurrent) {
      const next = await tx.release.findFirst({
        where: { status: "PUBLISHED", id: { not: id } },
        orderBy: { releasedAt: { sort: "desc", nulls: "last" } },
        select: { id: true },
      });
      if (next) {
        await tx.release.update({ where: { id: next.id }, data: { isCurrent: true } });
      }
    }
  });
}
