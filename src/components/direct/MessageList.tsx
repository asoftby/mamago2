"use client";

import { Fragment, useMemo, useRef } from "react";
import type { DirectActorType, DirectThreadStatus } from "@prisma/client";
import { MessageBubble } from "./MessageBubble";
import { OccasionCard } from "./OccasionCard";
import styles from "./direct.module.css";

export interface MessageListOccasion {
  threadId: string;
  threadNumber: number;
  publicationTitle: string;
  status: DirectThreadStatus;
  createdAt: Date | string;
  emoji: string;
}

export interface MessageListMessage {
  id: string;
  threadId: string;
  senderType: DirectActorType;
  body: string;
  createdAt: Date | string;
  hidden: boolean;
  /** Set once the counterparty has read it; only provided for the viewer's own messages. */
  readAt?: Date | string | null;
}

type FeedItem =
  | { kind: "occasion"; at: number; occasion: MessageListOccasion }
  | { kind: "message"; at: number; message: MessageListMessage };

function buildFeed(occasions: MessageListOccasion[], messages: MessageListMessage[]): FeedItem[] {
  const items: FeedItem[] = [
    ...occasions.map((occasion): FeedItem => ({ kind: "occasion", at: new Date(occasion.createdAt).getTime(), occasion })),
    ...messages.map((message): FeedItem => ({ kind: "message", at: new Date(message.createdAt).getTime(), message })),
  ];
  // Stable tie-break: an occasion header goes right before its first message
  // (created in the same transaction).
  items.sort((a, b) => a.at - b.at || (a.kind === "occasion" ? -1 : 1));
  return items;
}

/** Day bucket in the viewer's locale — a dialog can span several days. */
function dayKey(at: number): string {
  return new Date(at).toLocaleDateString("ru-RU");
}

function formatDayLabel(at: number): string {
  const d = new Date(at);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("ru-RU", sameYear
    ? { day: "numeric", month: "long" }
    : { day: "numeric", month: "long", year: "numeric" });
}

export interface MessageListProps {
  occasions: MessageListOccasion[];
  messages: MessageListMessage[];
  /** Which senderTypes count as "mine" for bubble alignment — depends on viewer role. */
  mineSenderTypes: DirectActorType[];
  /** Show the compact "Поводы" jump-nav once there's more than one occasion. */
  showOccasionNav?: boolean;
}

/**
 * Shared merged feed: occasion header blocks interleaved with message
 * bubbles, plus an optional compact "Поводы" quick-nav that scrolls to a
 * given occasion — used identically by the customer and business views of
 * the same conversation.
 */
export function MessageList({ occasions, messages, mineSenderTypes, showOccasionNav = true }: MessageListProps) {
  const feed = useMemo(() => buildFeed(occasions, messages), [occasions, messages]);
  const occasionRefs = useRef(new Map<string, HTMLDivElement | null>());

  function scrollToOccasion(threadId: string) {
    occasionRefs.current.get(threadId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      {showOccasionNav && occasions.length > 1 && (
        <div className={styles.occasionNav}>
          <div className={styles.occasionNavTitle}>Поводы</div>
          <div className={styles.occasionNavList}>
            {occasions.map((o) => (
              <button
                key={o.threadId}
                type="button"
                className={styles.occasionNavItem}
                onClick={() => scrollToOccasion(o.threadId)}
              >
                <span aria-hidden>{o.emoji}</span> {o.publicationTitle}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.messages}>
        {feed.map((item, index) => {
          // Centered day label before the first item of each day (under an occasion card, above a message).
          const startsNewDay = index === 0 || dayKey(feed[index - 1].at) !== dayKey(item.at);
          const separator = startsNewDay ? (
            <div className={styles.daySeparator}>
              <span>{formatDayLabel(item.at)}</span>
            </div>
          ) : null;

          if (item.kind === "occasion") {
            const { occasion } = item;
            return (
              <Fragment key={`occasion-${occasion.threadId}`}>
                <OccasionCard
                  ref={(el) => {
                    occasionRefs.current.set(occasion.threadId, el);
                  }}
                  emoji={occasion.emoji}
                  publicationTitle={occasion.publicationTitle}
                  threadNumber={occasion.threadNumber}
                  status={occasion.status}
                />
                {/* The day label goes under the occasion card, right before its first message. */}
                {separator}
              </Fragment>
            );
          }

          const m = item.message;
          return (
            <Fragment key={m.id}>
              {separator}
              <MessageBubble
                senderType={m.senderType}
                body={m.body}
                createdAt={m.createdAt}
                hidden={m.hidden}
                isMine={mineSenderTypes.includes(m.senderType)}
                // Ticks only for messages whose read state is per-recipient: CUSTOMER/BUSINESS.
                // ADMIN (staff) messages are marked read for both sides, so they get none.
                deliveryStatus={
                  mineSenderTypes.includes(m.senderType) && (m.senderType === "CUSTOMER" || m.senderType === "BUSINESS")
                    ? m.readAt ? "read" : "sent"
                    : undefined
                }
              />
            </Fragment>
          );
        })}
      </div>
    </>
  );
}
