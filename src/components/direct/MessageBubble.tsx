import type { DirectActorType } from "@prisma/client";
import styles from "./direct.module.css";

function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export interface MessageBubbleProps {
  senderType: DirectActorType;
  body: string;
  createdAt: Date | string;
  hidden: boolean;
  /** Whether this message was sent by whoever is currently viewing the conversation. */
  isMine: boolean;
  /** Telegram-style ticks for the viewer's own messages: sent = one tick, read by the other side = two ticks. */
  deliveryStatus?: "sent" | "read";
}

function DeliveryTicks({ status }: { status: "sent" | "read" }) {
  const read = status === "read";
  return (
    <svg
      className={read ? styles.tickRead : styles.tickSent}
      width={read ? 17 : 12}
      height="11"
      viewBox={read ? "0 0 17 11" : "0 0 12 11"}
      role="img"
      aria-label={read ? "Прочитано" : "Отправлено"}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 5.8 4.4 9.2 10.6 1.8" />
      {read && <path d="M6.4 8.6l.8.8 6.2-7.6" />}
    </svg>
  );
}

/**
 * Shared message bubble — "mine" is relative to the viewer (CUSTOMER or
 * BUSINESS side), so the same component renders correctly no matter who's
 * looking at the conversation.
 */
export function MessageBubble({ senderType, body, createdAt, hidden, isMine, deliveryStatus }: MessageBubbleProps) {
  const isSystem = senderType === "SYSTEM";
  const time = formatTime(createdAt);
  return (
    <div className={`${styles.bubbleRow} ${isMine ? styles.bubbleRowCustomer : styles.bubbleRowOther}`}>
      <div
        className={[
          styles.bubble,
          isSystem ? styles.bubbleSystem : isMine ? styles.bubbleCustomer : styles.bubbleOther,
          hidden ? styles.bubbleHidden : "",
        ].join(" ")}
      >
        {body}
        {isSystem ? (
          <div className={styles.bubbleMeta}>{time}</div>
        ) : (
          // Telegram-style: time sits in the bubble's bottom-right corner, on the
          // last text line when it fits, otherwise on its own line below.
          <span className={styles.bubbleTime}>
            {time}
            {deliveryStatus && <DeliveryTicks status={deliveryStatus} />}
          </span>
        )}
      </div>
    </div>
  );
}
