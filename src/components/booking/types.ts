/**
 * Booking/Sales Module Types
 * 
 * Unified types for event booking and service sales
 */

export type BookingMode = 'single' | 'multi-date' | 'slots';

export type AvailabilityStatus = 'available' | 'low' | 'sold-out';

export interface BookingSlot {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  status: AvailabilityStatus;
  remaining: number;
  disabled?: boolean;
}

export interface BookingDateOption {
  id: string;
  label: string;
  isoDate: string;
  status: AvailabilityStatus;
  remaining: number;
  slots?: BookingSlot[];
}

export interface BookingProduct {
  id: string;
  mode: BookingMode;
  title: string;
  subtitle?: string;
  meta?: string;
  priceLabel: string;
  priceSubtext?: string;
  ctaLabel: string;
  dates?: BookingDateOption[];
  singleDateLabel?: string;
  singleTimeLabel?: string;
  availabilityStatus?: AvailabilityStatus;
  availabilityText?: string;
}
