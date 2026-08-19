"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare, Search } from "lucide-react";
import type {
  ConversationTab,
  UnifiedConversationListItem,
} from "@/server/services/direct/directConversation.service";
import { UnreadBadge } from "@/components/direct/UnreadBadge";
import { StatusBadge, type DirectDisplayStatus } from "@/components/direct/StatusBadge";
import styles from "@/components/direct/direct.module.css";

interface Props {
  initialConversations: UnifiedConversationListItem[];
  initialCounts: Record<ConversationTab, number>;
}

const TABS: { value: ConversationTab; label: string }[] = [
  { value: "ALL", label: "Все" },
  { value: "ACTIVE", label: "Активные" },
  { value: "WAITING", label: "Ждут ответа" },
  { value: "COMPLETED", label: "Завершённые" },
  { value: "ARCHIVE", label: "Архив" },
];

function toDisplayStatus(tab: UnifiedConversationListItem["tab"]): DirectDisplayStatus {
  return tab;
}

function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} ч назад`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "вчера";
  if (diffD < 7) return `${diffD} дн назад`;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function pluralOccasions(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "обращение";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "обращения";
  return "обращений";
}

export function DirectListClient({ initialConversations, initialCounts }: Props) {
  const [tab, setTab] = useState<ConversationTab>("ALL");
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    let items = tab === "ALL" ? initialConversations : initialConversations.filter((item) => item.tab === tab);
    const needle = search.trim().toLowerCase();
    if (needle) {
      items = items.filter(
        (item) =>
          item.counterpartyName.toLowerCase().includes(needle) ||
          item.latestPublicationTitle.toLowerCase().includes(needle) ||
          String(item.latestThreadNumber).includes(needle.replace(/^d-?/i, "")),
      );
    }
    return items;
  }, [initialConversations, tab, search]);

  const total = initialCounts.ALL;

  return (
    <div className={styles.page}>
      <div className={`${styles.wrap} ${styles.breadcrumbs}`}>
        <Link href="/me">← Профиль</Link>
        <span style={{ opacity: 0.5 }}>→</span>
        <span style={{ color: "var(--ink)" }}>Мои сообщения</span>
      </div>

      <section style={{ paddingTop: 20, paddingBottom: 36 }}>
        <div className={`${styles.wrap} ${styles.heroGrid}`}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <span className={styles.caps} style={{ color: "var(--accent-deep)" }}>
                ● Профиль · сообщения
              </span>
              <span style={{ width: 5, height: 5, borderRadius: 99, background: "var(--ink-3)" }} />
              <span className={styles.caps}>Переписки с организациями</span>
            </div>
            <h1 className={styles.heroTitle}>
              Мои <span className={styles.heroTitleAccent}>сообщения.</span>
            </h1>
            <p className={styles.heroLead}>
              Одна переписка на каждую организацию — все ваши заявки и вопросы к ней в одном месте.
            </p>
          </div>

          {total > 0 ? (
            <div className={styles.heroSide}>
              <div className={styles.countCard}>
                <span className={styles.caps} style={{ color: "var(--accent-deep)" }}>
                  ● переписок
                </span>
                <div className={styles.serif} style={{ fontSize: 34, lineHeight: 1, letterSpacing: "-.02em" }}>
                  {total}
                </div>
                <div className={styles.mono} style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: ".06em", textTransform: "uppercase" }}>
                  ● {initialCounts.ACTIVE} активны · {initialCounts.WAITING} ждут ответа
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {total > 0 ? (
        <section className={styles.wrap} style={{ marginBottom: 24, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <div className={styles.filters}>
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={`${styles.pill} ${t.value === tab ? styles.pillSolid : ""}`.trim()}
              >
                {t.label}
                <span className={styles.count}>{String(initialCounts[t.value]).padStart(2, "0")}</span>
              </button>
            ))}
          </div>

          <div style={{ position: "relative", width: 260, maxWidth: "100%" }}>
            <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Номер, организация, имя..."
              style={{
                height: 38, width: "100%", paddingLeft: 38, paddingRight: 14, borderRadius: 99,
                border: "1px solid var(--line-2)", background: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit",
              }}
            />
          </div>
        </section>
      ) : null}

      <section className={styles.wrap} style={{ paddingBottom: 80 }}>
        {visible.length > 0 ? (
          <div className={styles.recList}>
            {visible.map((item) => (
              <Link key={item.key} href={`/me/direct/${item.latestThreadId}`} className={styles.recCard}>
                <div className={styles.recMain}>
                  <div className={styles.brandAvatar}>
                    {item.counterpartyLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.counterpartyLogoUrl} alt="" width={52} height={52} />
                    ) : (
                      item.counterpartyName.slice(0, 1).toUpperCase()
                    )}
                  </div>

                  <div className={styles.recBody}>
                    <span className={styles.recTitle}>{item.counterpartyName}</span>
                    <div className={styles.recBrand}>
                      {item.viewerRole === "BUSINESS" && <span className={styles.roleHint}>Вы — организация · </span>}
                      {item.occasionCount > 1 && `${item.occasionCount} ${pluralOccasions(item.occasionCount)}`}
                    </div>
                    {item.lastMessagePreview && (
                      <div className={styles.recPreview}>{item.lastMessagePreview}</div>
                    )}
                  </div>

                  <div className={styles.recRail}>
                    <StatusBadge status={toDisplayStatus(item.tab)} />
                    <span className={styles.lastActivity}>{formatRelativeTime(item.lastMessageAt)}</span>
                    <UnreadBadge count={item.unreadCount} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState hasAnyConversations={total > 0} />
        )}
      </section>
    </div>
  );
}

function EmptyState({ hasAnyConversations }: { hasAnyConversations: boolean }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptySpark}>
        <MessageSquare size={32} />
      </div>
      <h3 className={styles.emptyTitle}>
        {hasAnyConversations ? (
          <>Ничего не <span className={styles.emptyTitleAccent}>найдено</span></>
        ) : (
          <>Здесь будут ваши <span className={styles.emptyTitleAccent}>сообщения</span></>
        )}
      </h3>
      <p className={styles.emptyLead}>
        {hasAnyConversations
          ? "Переписок с таким статусом или именем нет. Попробуйте другой фильтр или запрос."
          : "Здесь будут ваши переписки с организациями."}
      </p>
    </div>
  );
}
