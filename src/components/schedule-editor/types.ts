/**
 * Schedule Editor Types
 * 
 * Types for date and slot scheduling interface
 */

export interface ScheduleSlot {
  id: string;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  capacity: number;
}

export interface ScheduleDate {
  id: string;
  isoDate: string; // YYYY-MM-DD
  label: string; // Display label like "18 марта, ср"
  slots: ScheduleSlot[];
}

export interface ScheduleEditorValue {
  dates: ScheduleDate[];
}

export interface SlotFormData {
  startTime: string;
  endTime: string;
  capacity: number;
}
