"use client";

import { WELCOME_DEPRECATED_TELEGRAM_PROMPT_LINE } from "@/lib/notifications/welcomeNotification";
import { cn } from "@/lib/utils";

type Props = {
  body: string;
  type: string;
  lineClamp?: boolean;
};

export function NotificationMessageBody({
  body,
  type,
  lineClamp = true,
}: Props) {
  if (type === "WELCOME") {
    const paragraphs = body
      .split(/\n\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((p) => p !== WELCOME_DEPRECATED_TELEGRAM_PROMPT_LINE);

    return (
      <div className="mt-1 space-y-3">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-gray-600">
            {p}
          </p>
        ))}
      </div>
    );
  }

  return (
    <p
      className={cn(
        "mt-1 text-sm text-gray-600",
        lineClamp && "line-clamp-2",
      )}
    >
      {body}
    </p>
  );
}
