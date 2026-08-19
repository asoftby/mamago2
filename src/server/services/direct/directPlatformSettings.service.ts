/**
 * Phase 6 — Direct Settings & Communication Policy.
 *
 * This is platform-wide policy, not a per-thread/per-publication setting:
 * "администратор управляет не пользователями, а правилами работы системы."
 * Storage is a singleton row (DirectPlatformSettings, id="singleton") — same
 * convention as RankingSettings/BoostSettings elsewhere in this codebase.
 *
 * Only floodMessageCount/floodIntervalSeconds/floodLockMinutes/noReplyCapCount
 * and the contactDetect* toggles are actually consumed by Trust & Safety
 * (see directRiskSignal.service.ts) — everything else (per-type policy,
 * contactVisibility, autoCloseDays/autoArchiveDays, allowBusinessReopenAfterCompletion)
 * is storage-only for this phase; no send path or cron reads it yet.
 */

import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { DirectCommunicationMode, DirectContactVisibility } from "@prisma/client";
import prisma from "@/lib/prisma";
import { DIRECT_AUDIT_ENTITY, DirectAuditAction, writeDirectAudit } from "./directAudit";

// ─── Per-publication-type policy shape (stored as JSON) ────────────────────

export const directTypePolicySchema = z
  .object({
    enabled: z.boolean(),
    defaultMode: z.nativeEnum(DirectCommunicationMode),
    allowedModes: z.array(z.nativeEnum(DirectCommunicationMode)).min(1),
    businessOverrideAllowed: z.boolean(),
    directRequired: z.boolean(),
  })
  .refine((policy) => policy.allowedModes.includes(policy.defaultMode), {
    message: "defaultMode must be one of allowedModes",
  });

export type DirectTypePolicy = z.infer<typeof directTypePolicySchema>;

export const DIRECT_POLICY_PUBLICATION_TYPES = ["OFFER", "EVENT", "PLACE"] as const;
export type DirectPolicyPublicationType = (typeof DIRECT_POLICY_PUBLICATION_TYPES)[number];
export type DirectPublicationTypePolicyMap = Record<DirectPolicyPublicationType, DirectTypePolicy>;

const publicationTypePolicyMapSchema = z.object({
  OFFER: directTypePolicySchema,
  EVENT: directTypePolicySchema,
  PLACE: directTypePolicySchema,
});

/** Matches the concrete examples in the Phase 6 brief exactly. */
const DEFAULT_POLICY_MAP: DirectPublicationTypePolicyMap = {
  OFFER: {
    enabled: true,
    defaultMode: DirectCommunicationMode.DIRECT_ONLY,
    allowedModes: [DirectCommunicationMode.DIRECT_ONLY, DirectCommunicationMode.DIRECT_AND_CONTACTS],
    businessOverrideAllowed: true,
    directRequired: false,
  },
  EVENT: {
    enabled: true,
    defaultMode: DirectCommunicationMode.DIRECT_AND_CONTACTS,
    allowedModes: [
      DirectCommunicationMode.DIRECT_ONLY,
      DirectCommunicationMode.DIRECT_AND_CONTACTS,
      DirectCommunicationMode.CONTACTS_ONLY,
      DirectCommunicationMode.EXTERNAL_BOOKING,
    ],
    businessOverrideAllowed: true,
    directRequired: false,
  },
  PLACE: {
    enabled: true,
    defaultMode: DirectCommunicationMode.CONTACTS_ONLY,
    allowedModes: [
      DirectCommunicationMode.CONTACTS_ONLY,
      DirectCommunicationMode.DIRECT_AND_CONTACTS,
      DirectCommunicationMode.DIRECT_ONLY,
    ],
    businessOverrideAllowed: true,
    directRequired: false,
  },
};

function parsePolicyMap(raw: Prisma.JsonValue): DirectPublicationTypePolicyMap {
  const parsed = publicationTypePolicyMapSchema.safeParse(raw);
  // Falls back to defaults on a corrupted/missing shape rather than throwing —
  // this is read from checkDirectSendLimits on every message send.
  return parsed.success ? parsed.data : DEFAULT_POLICY_MAP;
}

// ─── DTO ────────────────────────────────────────────────────────────────────

export interface DirectPlatformSettingsDTO {
  publicationTypePolicy: DirectPublicationTypePolicyMap;
  allowBusinessReopenAfterCompletion: boolean;
  contactVisibility: DirectContactVisibility;
  autoCloseDays: number | null;
  autoArchiveDays: number | null;
  floodMessageCount: number;
  floodIntervalSeconds: number;
  floodLockMinutes: number;
  noReplyCapCount: number;
  contactDetectPhone: boolean;
  contactDetectEmail: boolean;
  contactDetectLink: boolean;
  contactDetectTelegram: boolean;
  contactDetectWhatsapp: boolean;
  contactDetectInstagram: boolean;
  updatedAt: Date;
  updatedByUserId: string | null;
}

type SettingsRow = Awaited<ReturnType<typeof prisma.directPlatformSettings.upsert>>;

function toDTO(row: SettingsRow): DirectPlatformSettingsDTO {
  return {
    publicationTypePolicy: parsePolicyMap(row.publicationTypePolicy),
    allowBusinessReopenAfterCompletion: row.allowBusinessReopenAfterCompletion,
    contactVisibility: row.contactVisibility,
    autoCloseDays: row.autoCloseDays,
    autoArchiveDays: row.autoArchiveDays,
    floodMessageCount: row.floodMessageCount,
    floodIntervalSeconds: row.floodIntervalSeconds,
    floodLockMinutes: row.floodLockMinutes,
    noReplyCapCount: row.noReplyCapCount,
    contactDetectPhone: row.contactDetectPhone,
    contactDetectEmail: row.contactDetectEmail,
    contactDetectLink: row.contactDetectLink,
    contactDetectTelegram: row.contactDetectTelegram,
    contactDetectWhatsapp: row.contactDetectWhatsapp,
    contactDetectInstagram: row.contactDetectInstagram,
    updatedAt: row.updatedAt,
    updatedByUserId: row.updatedByUserId,
  };
}

/** Lazily creates the singleton row with defaults on first read (same pattern as RankingSettings/BoostSettings). */
export async function getDirectPlatformSettings(): Promise<DirectPlatformSettingsDTO> {
  const row = await prisma.directPlatformSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      publicationTypePolicy: DEFAULT_POLICY_MAP as unknown as Prisma.InputJsonValue,
    },
    update: {},
  });
  return toDTO(row);
}

// ─── Update (validated, audited) ────────────────────────────────────────────

export const updateDirectPlatformSettingsSchema = z.object({
  publicationTypePolicy: publicationTypePolicyMapSchema.optional(),
  allowBusinessReopenAfterCompletion: z.boolean().optional(),
  contactVisibility: z.nativeEnum(DirectContactVisibility).optional(),
  autoCloseDays: z.number().int().positive().nullable().optional(),
  autoArchiveDays: z.number().int().positive().nullable().optional(),
  floodMessageCount: z.number().int().min(2).max(50).optional(),
  floodIntervalSeconds: z.number().int().min(5).max(600).optional(),
  floodLockMinutes: z.number().int().min(1).max(1440).optional(),
  noReplyCapCount: z.number().int().min(1).max(20).optional(),
  contactDetectPhone: z.boolean().optional(),
  contactDetectEmail: z.boolean().optional(),
  contactDetectLink: z.boolean().optional(),
  contactDetectTelegram: z.boolean().optional(),
  contactDetectWhatsapp: z.boolean().optional(),
  contactDetectInstagram: z.boolean().optional(),
});

export type UpdateDirectPlatformSettingsInput = z.infer<typeof updateDirectPlatformSettingsSchema>;

function toJsonSafe(dto: DirectPlatformSettingsDTO): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(dto));
}

export async function updateDirectPlatformSettings(
  patch: UpdateDirectPlatformSettingsInput,
  actor: { userId: string; role: string },
): Promise<DirectPlatformSettingsDTO> {
  const validated = updateDirectPlatformSettingsSchema.parse(patch);
  const { publicationTypePolicy, ...scalarPatch } = validated;

  const before = await getDirectPlatformSettings();

  const updated = await prisma.directPlatformSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      publicationTypePolicy: (publicationTypePolicy ?? DEFAULT_POLICY_MAP) as unknown as Prisma.InputJsonValue,
      ...scalarPatch,
      updatedByUserId: actor.userId,
    },
    update: {
      ...(publicationTypePolicy ? { publicationTypePolicy: publicationTypePolicy as unknown as Prisma.InputJsonValue } : {}),
      ...scalarPatch,
      updatedByUserId: actor.userId,
    },
  });

  const after = toDTO(updated);

  await writeDirectAudit({
    action: DirectAuditAction.DIRECT_SETTINGS_UPDATED,
    entityType: DIRECT_AUDIT_ENTITY.PLATFORM_SETTINGS,
    entityId: "singleton",
    actorId: actor.userId,
    actorRole: actor.role,
    before: toJsonSafe(before),
    after: toJsonSafe(after),
  });

  return after;
}
