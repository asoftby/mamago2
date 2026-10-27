import { BookingAllocationStatus, BookingStatus } from "@prisma/client";

type Allocation = { status: BookingAllocationStatus; expiresAt: Date | null };

export function allocationTransition(
  nextStatus: BookingStatus,
  allocations: readonly Allocation[],
  now: Date,
): BookingAllocationStatus | null {
  if (nextStatus === BookingStatus.CONFIRMED) {
    const invalid = allocations.some((allocation) =>
      (allocation.status !== BookingAllocationStatus.HELD &&
        allocation.status !== BookingAllocationStatus.CONFIRMED) ||
      (allocation.status === BookingAllocationStatus.HELD &&
        allocation.expiresAt !== null && allocation.expiresAt <= now),
    );
    if (invalid) throw new Error("Резерв истёк или освобождён. Выберите свободное время заново.");
    return BookingAllocationStatus.CONFIRMED;
  }
  if (nextStatus === BookingStatus.REJECTED || nextStatus === BookingStatus.CANCELLED) {
    return BookingAllocationStatus.RELEASED;
  }
  return null;
}
