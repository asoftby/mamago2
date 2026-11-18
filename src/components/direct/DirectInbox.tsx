"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import type {
  ConversationTab,
  UnifiedConversationListItem,
} from "@/server/services/direct/directConversation.service";
import { DirectListClient } from "@/app/(public)/me/direct/DirectListClient";
import { BusinessDirectInbox } from "@/app/business/(protected)/direct/BusinessDirectInbox";
import { MessageSquare } from "lucide-react";
import { DirectInboxContext } from "./DirectInboxContext";
import styles from "./direct.module.css";

interface Props {
  variant: "customer" | "business";
  initialConversations: UnifiedConversationListItem[];
  initialCounts: Record<ConversationTab, number>;
  /** The routed page: a thread, or the «select a dialog» placeholder. */
  children: ReactNode;
}

/**
 * Two-column messages shell (≥1024px): conversation list on the left, the open
 * dialog on the right. On phones it behaves like before — list OR dialog, decided
 * by the route. The list comes from the layout (fetched once, kept while moving
 * between dialogs); opening a dialog clears its unread badge locally instead of
 * refetching the list.
 */
export function DirectInbox({ variant, initialConversations, initialCounts, children }: Props) {
  const selectedThreadId = useSelectedLayoutSegment();
  const splitRef = useRef<HTMLDivElement>(null);

  // The desktop workspace is one screen tall below wherever it starts (site header,
  // cabinet header…): measure that offset instead of hard-coding it per surface.
  useLayoutEffect(() => {
    const el = splitRef.current;
    if (!el) return;
    const measure = () => {
      el.style.removeProperty("--inbox-top");
      el.style.setProperty("--inbox-top", `${Math.round(el.getBoundingClientRect().top + window.scrollY)}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const [readThreadIds, setReadThreadIds] = useState<ReadonlySet<string>>(() => new Set());

  const markThreadsRead = useCallback((threadIds: string[]) => {
    setReadThreadIds((prev) => {
      if (threadIds.every((id) => prev.has(id))) return prev;
      return new Set([...prev, ...threadIds]);
    });
  }, []);

  // Derived from props + the read set, so a server refresh can never leave stale state behind.
  const conversations = useMemo(
    () =>
      readThreadIds.size === 0
        ? initialConversations
        : initialConversations.map((item) =>
            item.unreadCount > 0 && item.threadIds.some((id) => readThreadIds.has(id))
              ? { ...item, unreadCount: 0 }
              : item,
          ),
    [initialConversations, readThreadIds],
  );

  const contextValue = useMemo(
    () => ({ selectedThreadId, markThreadsRead }),
    [selectedThreadId, markThreadsRead],
  );

  return (
    <DirectInboxContext.Provider value={contextValue}>
      <div ref={splitRef} className={styles.inboxSplit} data-has-thread={selectedThreadId ? "true" : "false"}>
        <aside className={styles.inboxList}>
          {variant === "customer" ? (
            <DirectListClient
              initialConversations={conversations}
              initialCounts={initialCounts}
              selectedThreadId={selectedThreadId}
            />
          ) : (
            <BusinessDirectInbox
              initialConversations={conversations}
              initialCounts={initialCounts}
              selectedThreadId={selectedThreadId}
            />
          )}
        </aside>
        <section className={styles.inboxDetail} data-inbox-detail>{children}</section>
      </div>
    </DirectInboxContext.Provider>
  );
}

/** Right-hand placeholder while no dialog is open (desktop only; phones show the list). */
export function DirectInboxEmptyDetail() {
  return (
    <div className={styles.inboxEmpty}>
      <MessageSquare size={32} aria-hidden="true" />
      <p>Выберите диалог слева</p>
    </div>
  );
}
