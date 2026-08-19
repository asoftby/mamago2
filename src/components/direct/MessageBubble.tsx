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
}

/**
 * Shared message bubble — "mine" is relative to the viewer (CUSTOMER or
 * BUSINESS side), so the same component renders correctly no matter who's
 * looking at the conversation.
 */
export function MessageBubble({ senderType, body, createdAt, hidden, isMine }: MessageBubbleProps) {
  const isSystem = senderType === "SYSTEM";
  return (
    <div className={`${styles.bubbleRow} ${isMine ? styles.bubbleRowCustomer : styles.bubbleRowOther}`}>
      <div>
        <div
          className={[
            styles.bubble,
            isSystem ? styles.bubbleSystem : isMine ? styles.bubbleCustomer : styles.bubbleOther,
            hidden ? styles.bubbleHidden : "",
          ].join(" ")}
        >
          {body}
        </div>
        <div className={styles.bubbleMeta} style={{ textAlign: isMine ? "right" : "left" }}>
          {formatTime(createdAt)}
        </div>
      </div>
    </div>
  );
}
