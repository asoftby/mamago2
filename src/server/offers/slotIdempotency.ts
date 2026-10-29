import { createHash } from "node:crypto";

/** The canonical intent contains only stable, customer-chosen inputs. Never
 * include mutable prices, inventory snapshots, or the current time. */
export type SlotIntent = {
  offerId: string;
  classGroupId?: string | null;
  classTariffId?: string | null;
  selectedOptionIds?: string[];
  startsAt: Date;
  endsAt: Date;
  seats?: number;
  unitId?: string;
  unitIds?: string[];
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerComment?: string | null;
  userId?: string | null;
  planItemId?: string | null;
  childId?: string | null;
  childName?: string | null;
  childAge?: number | null;
  holdMinutes?: number;
};

/** Hash a canonical request so a reused key cannot silently mutate an order. */
export function slotIntentHash(input: SlotIntent): string {
  const canonical = [
    input.offerId,
    input.classGroupId ?? null,
    input.classTariffId ?? null,
    [...(input.selectedOptionIds ?? [])].sort(),
    input.startsAt.toISOString(),
    input.endsAt.toISOString(),
    input.seats ?? 1,
    input.unitId ?? null,
    [...(input.unitIds ?? [])].sort(),
    input.customerName.trim(),
    input.customerPhone.trim(),
    input.customerEmail?.trim() || null,
    input.customerComment?.trim() || null,
    input.userId ?? null,
    input.planItemId ?? null,
    input.childId ?? null,
    input.childName?.trim() || null,
    input.childAge ?? null,
    input.holdMinutes ?? 24 * 60,
  ];
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/** Signed 64-bit advisory lock key. The actual authoritative uniqueness check
 * remains the database UNIQUE constraint (hash collisions cannot merge orders). */
export function slotKeyLock(offerId: string, key: string): bigint {
  return createHash("sha256").update(`mamaGo:slot:${offerId}:${key}`)
    .digest().readBigInt64BE(0);
}

export function validSlotKey(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
