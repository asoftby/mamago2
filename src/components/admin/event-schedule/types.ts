/**
 * Event Schedule Types
 * UI model for admin event schedule module
 */

export type RecurrenceUnit = "day" | "week" | "month" | "year";

export interface EventScheduleItem {
  id: string;
  isMultiDay: boolean;
  date: string | null;
  dateEnd?: string | null; // End date for multi-day events
  allDay: boolean;
  startTime: string;
  endTime: string;
  recurringEnabled: boolean;
  recurrenceInterval: number;
  recurrenceUnit: RecurrenceUnit;
  recurrenceUntil: string | null;
  isCollapsed?: boolean;
}

export interface EventScheduleCardProps {
  item: EventScheduleItem;
  onChange: (item: EventScheduleItem) => void;
  onRemove: () => void;
  canRemove: boolean;
  disabled?: boolean;
}

export interface EventScheduleListProps {
  items: EventScheduleItem[];
  onChange: (items: EventScheduleItem[]) => void;
  disabled?: boolean;
}
