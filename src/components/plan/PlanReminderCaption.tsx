"use client";

import type { CSSProperties } from "react";
import {
  formatPlanReminderBullet,
  getPlanReminderLabelFromPlanItem,
} from "@/lib/plan/getPlanReminderLabel";

const CAPTION_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace)",
  fontSize: 11,
  color: "rgba(20,18,16,0.55)",
  marginTop: 3,
  letterSpacing: ".04em",
};

export function PlanReminderCaption({
  planDate,
  planStartsAt,
  className,
  style,
}: {
  planDate: string;
  planStartsAt?: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  const bullet = formatPlanReminderBullet(
    getPlanReminderLabelFromPlanItem({ planDate, planStartsAt }),
  );
  if (!bullet) return null;

  return (
    <div className={className} style={{ ...CAPTION_STYLE, ...style }}>
      {bullet}
    </div>
  );
}
