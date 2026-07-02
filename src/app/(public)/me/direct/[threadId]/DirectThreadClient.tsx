"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DirectActorType } from "@prisma/client";
import type { UnifiedConversationDetail } from "@/server/services/direct/directConversation.service";
import { ConversationHeader } from "@/components/direct/ConversationHeader";
import { MessageList } from "@/components/direct/MessageList";
import { DirectComplaintModal } from "@/components/direct/DirectComplaintModal";
import { toast } from "@/lib/toast";
import styles from "@/components/direct/direct.module.css";

// Polling only while this screen is open — no global notification-bridge
// reuse here on purpose (that one is for the bell across the whole app).
const POLL_MS = 45_000;

const QUICK_REPLIES = [
  "Здравствуйте! Спасибо за обращение.",
  "Да, эта дата свободна.",
  "К сожалению, дата уже занята.",
  "Мы свяжемся с вами в ближайшее время.",
  "Спасибо! Ждём вас.",
];

interface Props {
  initialDetail: UnifiedConversationDetail;
}

function statusLabel(status: UnifiedConversationDetail["occasions"][number]["status"]): string {
  switch (status) {
    case "BLOCKED":
      return "Заблокирован";
    case "ARCHIVED":
      return "Архив";
    case "CLOSED":
      return "Завершена";
    default:
      return "В работе";
  }
}

export function DirectThreadClient({ initialDetail }: Props) {
  const [detail, setDetail] = useState(initialDetail);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const markedReadRef = useRef(false);

  const isBusinessViewer = detail.viewerRole === "BUSINESS";
  const mineSenderTypes: DirectActorType[] = isBusinessViewer
    ? [DirectActorType.BUSINESS, DirectActorType.ADMIN]
    : [DirectActorType.CUSTOMER];

  const anchorThreadId = detail.occasions[detail.occasions.length - 1]?.threadId ?? null;
  const complaintTargetThreadId = detail.replyTargetThreadId ?? anchorThreadId;
  const latestOccasion = detail.occasions[detail.occasions.length - 1];
  const lastMessage = detail.messages[detail.messages.length - 1];
  const isWaitingOnMe =
    detail.canWrite && lastMessage && !mineSenderTypes.includes(lastMessage.senderType);

  // Mark-read once on mount, across every occasion — not on every poll.
  useEffect(() => {
    if (markedReadRef.current) return;
    markedReadRef.current = true;
    for (const occasion of detail.occasions) {
      fetch(`/api/direct/${occasion.threadId}/read`, { method: "POST", credentials: "include" }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!anchorThreadId) return;
    let intervalId: number | null = null;

    async function refresh() {
      try {
        const res = await fetch(`/api/direct/${anchorThreadId}`, { credentials: "include" });
        if (!res.ok) return;
        setDetail(await res.json());
      } catch {
        // Silent — next tick retries.
      }
    }

    function start() {
      if (intervalId !== null) return;
      intervalId = window.setInterval(refresh, POLL_MS);
    }
    function stop() {
      if (intervalId === null) return;
      window.clearInterval(intervalId);
      intervalId = null;
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        void refresh();
        start();
      } else {
        stop();
      }
    }

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [anchorThreadId]);

  async function refreshDetail() {
    if (!anchorThreadId) return;
    const res = await fetch(`/api/direct/${anchorThreadId}`, { credentials: "include" });
    if (res.ok) setDetail(await res.json());
  }

  async function sendMessage() {
    const trimmed = body.trim();
    if (!trimmed || sending || !detail.replyTargetThreadId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/direct/${detail.replyTargetThreadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: trimmed }),
      });
      if (res.ok) {
        setBody("");
        await refreshDetail();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Не удалось отправить сообщение");
      }
    } finally {
      setSending(false);
    }
  }

  async function completeConversation() {
    if (completing || !detail.replyTargetThreadId) return;
    setCompleting(true);
    try {
      const res = await fetch(`/api/business/direct/${detail.replyTargetThreadId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "complete" }),
      });
      if (res.ok) {
        await refreshDetail();
        toast.success("Обращение завершено");
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Не удалось завершить обращение");
      }
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={`${styles.wrap} ${styles.breadcrumbs}`}>
        <Link href="/me/direct">← Мои сообщения</Link>
      </div>

      <div className={styles.threadWrap}>
        <ConversationHeader
          counterpartyName={detail.counterpartyName}
          counterpartyLogoUrl={detail.counterpartyLogoUrl}
          occasionCount={detail.occasions.length}
          latestStatusLabel={latestOccasion ? statusLabel(latestOccasion.status) : undefined}
        />

        {isWaitingOnMe && (
          <div className={`${styles.banner} ${styles.bannerWaiting}`}>
            {isBusinessViewer ? "Клиент ждёт ответа." : "Ожидаем ответ."}
          </div>
        )}

        <MessageList
          occasions={detail.occasions}
          messages={detail.messages}
          mineSenderTypes={mineSenderTypes}
        />

        {!detail.canWrite && (
          <div className={`${styles.banner} ${styles.bannerArchived}`}>
            {detail.occasions.some((o) => o.status === "BLOCKED")
              ? "Переписка временно ограничена модератором."
              : "Все обращения по этому диалогу завершены или в архиве — можно читать, но не отвечать."}
          </div>
        )}

        {detail.canWrite && isBusinessViewer && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {QUICK_REPLIES.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => setBody((prev) => (prev.trim() ? `${prev.trim()} ${reply}` : reply))}
                style={{
                  borderRadius: 99, border: "1px solid var(--line-2)", background: "#fff",
                  padding: "6px 12px", fontSize: 12, color: "var(--ink-2)", cursor: "pointer",
                }}
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        {detail.canWrite && (
          <div className={styles.inputBar}>
            <textarea
              className={styles.inputTextarea}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Написать сообщение..."
              rows={1}
            />
            <button
              type="button"
              className={styles.sendBtn}
              disabled={!body.trim() || sending}
              onClick={() => void sendMessage()}
            >
              Отправить
            </button>
          </div>
        )}

        <div className={styles.actionsRow} style={{ justifyContent: "space-between" }}>
          {isBusinessViewer && detail.canWrite ? (
            <button
              type="button"
              onClick={() => void completeConversation()}
              disabled={completing}
              style={{ fontSize: 12, color: "var(--ink-2)", background: "transparent", border: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              Завершить обращение
            </button>
          ) : <span />}
          <button type="button" className={styles.complainBtn} onClick={() => setComplaintOpen(true)}>
            Пожаловаться
          </button>
        </div>

        {!isBusinessViewer && latestOccasion?.status === "CLOSED" && (
          <div className={styles.ratingCard}>
            <div className={styles.ratingTitle}>Оцените общение</div>
            <div className={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`${styles.starBtn} ${n <= rating ? styles.starBtnActive : ""}`}
                  onClick={() => setRating(n)}
                  aria-label={`${n} из 5`}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l2.9 6.5 7.1.6-5.4 4.7 1.6 7-6.2-3.9L5.8 20.8l1.6-7L2 9.1l7.1-.6z" />
                  </svg>
                </button>
              ))}
            </div>
            <p className={styles.ratingNote}>
              {ratingSubmitted
                ? "Спасибо! Оценки диалогов пока не влияют на рейтинг — эта функция появится позже."
                : "Это не публичный отзыв — оценка поможет нам понимать качество общения с бизнесом."}
            </p>
            {!ratingSubmitted && rating > 0 && (
              <button
                type="button"
                onClick={() => setRatingSubmitted(true)}
                style={{
                  marginTop: 12, height: 40, padding: "0 20px", borderRadius: 99, border: 0,
                  background: "#E86A3A", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                Отправить оценку
              </button>
            )}
          </div>
        )}
      </div>

      {complaintTargetThreadId && (
        <DirectComplaintModal open={complaintOpen} onOpenChange={setComplaintOpen} threadId={complaintTargetThreadId} />
      )}
    </div>
  );
}
