/**
 * Urgency calculation utilities for Improvement Requests
 */

export type UrgencyLevel = "normal" | "due_soon" | "overdue";

export interface UrgencyStatus {
  level: UrgencyLevel;
  label: string;
  color: string;
  urgent: boolean;
}

/**
 * Calculate urgency level based on due date
 */
export function calculateUrgency(dueAt: Date | string | null): UrgencyStatus | null {
  if (!dueAt) return null;
  
  const due = new Date(dueAt);
  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return {
      level: "overdue",
      label: "Просрочено",
      color: "text-red-600",
      urgent: true,
    };
  }
  
  if (diffDays <= 2) {
    return {
      level: "due_soon",
      label: "Срочно",
      color: "text-orange-600",
      urgent: true,
    };
  }
  
  if (diffDays <= 7) {
    return {
      level: "due_soon",
      label: "Скоро",
      color: "text-yellow-600",
      urgent: false,
    };
  }
  
  return {
    level: "normal",
    label: "В работе",
    color: "text-gray-600",
    urgent: false,
  };
}

/**
 * Get severity configuration
 */
export const SEVERITY_CONFIG = {
  LOW: { label: "Низкая", color: "bg-blue-100 text-blue-800", icon: "🔵" },
  MEDIUM: { label: "Средняя", color: "bg-yellow-100 text-yellow-800", icon: "🟡" },
  HIGH: { label: "Высокая", color: "bg-orange-100 text-orange-800", icon: "🟠" },
  CRITICAL: { label: "Критическая", color: "bg-red-100 text-red-800", icon: "🔴" },
} as const;

export type SeverityLevel = keyof typeof SEVERITY_CONFIG;
