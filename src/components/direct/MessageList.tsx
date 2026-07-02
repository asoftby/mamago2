"use client";

import { useMemo, useRef } from "react";
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
        {feed.map((item) => {
          if (item.kind === "occasion") {
            const { occasion } = item;
            return (
              <OccasionCard
                key={`occasion-${occasion.threadId}`}
                ref={(el) => {
                  occasionRefs.current.set(occasion.threadId, el);
                }}
                emoji={occasion.emoji}
                publicationTitle={occasion.publicationTitle}
                threadNumber={occasion.threadNumber}
                status={occasion.status}
                createdAt={occasion.createdAt}
              />
            );
          }

          const m = item.message;
          return (
            <MessageBubble
              key={m.id}
              senderType={m.senderType}
              body={m.body}
              createdAt={m.createdAt}
              hidden={m.hidden}
              isMine={mineSenderTypes.includes(m.senderType)}
            />
          );
        })}
      </div>
    </>
  );
}
