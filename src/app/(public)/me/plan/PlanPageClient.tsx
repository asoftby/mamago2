"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { WeekCalendar } from "./WeekCalendar";
import { PlanDayList } from "./PlanDayList";
import { PlanProfileCompletionGate } from "./PlanProfileCompletionGate";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import type { PlanActivityPublicAvailability } from "@/lib/plan/publicVisibility";

export type SerializedPlanItem = {
  id: string;
  date: string;
  startsAt: string | null;
  activityId: string | null;
  title: string | null;
  coverImageUrl: string | null;
  planAvailability?: PlanActivityPublicAvailability;
  activity: {
    id: string;
    slug: string | null;
    title: string;
    type: string;
    coverImageUrl: string | null;
    ageLabel: string | null;
  } | null;
};

export type SerializedIdea = {
  id: string;
  activityId: string;
  createdAt: string;
  activity: {
    id: string;
    title: string;
    coverImageUrl: string | null;
    type: string;
    ageLabel: string | null;
    slug: string | null;
  } | null;
};

type Props = {
  initialItems: SerializedPlanItem[];
  ideaActivityIds: string[];
  childrenAges: number[];
  initialIdeas?: SerializedIdea[];
  activeReminder?: {
    id: string;
    title: string;
    body: string;
    ctaLabel: string | null;
    ctaAction: string | null;
    createdAt: string;
    isRead: boolean;
  } | null;
};

const MONTHS_RU = ["ЯНВАРЬ","ФЕВРАЛЬ","МАРТ","АПРЕЛЬ","МАЙ","ИЮНЬ","ИЮЛЬ","АВГУСТ","СЕНТЯБРЬ","ОКТЯБРЬ","НОЯБРЬ","ДЕКАБРЬ"];

function getTodayISO() {
  return new Date().toISOString().split("T")[0];
}

function pluralizeDays(n: number) {
  if (n === 1) return "день";
  if (n >= 2 && n <= 4) return "дня";
  return "дней";
}

function pluralizeEvents(n: number) {
  if (n === 1) return "событие";
  if (n >= 2 && n <= 4) return "события";
  return "событий";
}

function formatAddedDate(iso: string) {
  const d = new Date(iso);
  const months = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

// Placeholder tones for cards without an image
const TONES = [
  "linear-gradient(160deg, #CDE3D6, #9CC1AC)",
  "linear-gradient(160deg, #E6DBC8, #C9BCA0)",
  "linear-gradient(160deg, #F6D567, #E8B935)",
  "linear-gradient(160deg, #F2C8A7, #E89460)",
  "linear-gradient(160deg, #2A2622, #141210)",
];

function IdeasSidebar({ ideas }: { ideas: SerializedIdea[] }) {
  return (
    <aside style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span
          className="font-mono uppercase"
          style={{ fontSize: 11, letterSpacing: ".14em", color: "rgba(20,18,16,.55)", whiteSpace: "nowrap" }}
        >
          Без даты · Идеи
        </span>
        <div style={{ flex: 1, height: 1, background: "rgba(20,18,16,.10)" }} />
        <Link
          href="/me/ideas"
          style={{ fontSize: 12, color: "#C24E22", fontWeight: 600, whiteSpace: "nowrap" }}
        >
          Все →
        </Link>
      </div>

      {ideas.length === 0 ? (
        <div style={{
          padding: "20px 16px",
          background: "#FAF7F1",
          border: "1px dashed rgba(20,18,16,.18)",
          borderRadius: 14,
          textAlign: "center",
        }}>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(20,18,16,.55)", lineHeight: 1.5 }}>
            Сохраняйте активности в&nbsp;идеи — они появятся здесь
          </p>
        </div>
      ) : (
        ideas.map((idea, i) => {
          const title = idea.activity?.title ?? "Активность";
          const image = idea.activity?.coverImageUrl;
          const slug = idea.activity?.slug;
          const href = idea.activityId
            ? publicActivityPath(idea.activityId, "minsk", slug)
            : "/me/ideas";

          return (
            <Link
              key={idea.id}
              href={href}
              style={{
                display: "flex",
                gap: 12,
                padding: 14,
                background: "#FAF7F1",
                border: "1px solid rgba(20,18,16,.10)",
                borderRadius: 14,
                transition: "all .18s",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "#141210";
                (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(20,18,16,.10)";
                (e.currentTarget as HTMLAnchorElement).style.transform = "none";
              }}
            >
              <div style={{
                width: 54,
                height: 54,
                borderRadius: 10,
                flexShrink: 0,
                background: image ? "transparent" : TONES[i % TONES.length],
                overflow: "hidden",
              }}>
                {image && (
                  <img src={image} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
                <h4 style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.25,
                  color: "#141210",
                  letterSpacing: "-.005em",
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}>
                  {title}
                </h4>
                {idea.activity?.ageLabel && (
                  <span style={{ fontSize: 12, color: "rgba(20,18,16,.55)" }}>{idea.activity.ageLabel}</span>
                )}
                <span
                  className="font-mono uppercase"
                  style={{ fontSize: 10, letterSpacing: ".06em", color: "rgba(20,18,16,.55)", marginTop: 2 }}
                >
                  ● добавлено {formatAddedDate(idea.createdAt)}
                </span>
              </div>
            </Link>
          );
        })
      )}

      {/* Promo */}
      <div style={{
        padding: "16px 18px",
        borderRadius: 14,
        background: "linear-gradient(135deg, #FFE8DC, #FFF1E5)",
        border: "1px solid rgba(232,106,58,.2)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}>
        <span
          className="font-display"
          style={{ fontSize: 18, lineHeight: 1.15, letterSpacing: "-.01em", color: "#141210" }}
        >
          Перенесите <span style={{ fontStyle: "italic", color: "#C24E22" }}>идею</span> в&nbsp;план
        </span>
        <span style={{ fontSize: 12, color: "#3A332B" }}>Один клик — и&nbsp;мы&nbsp;напомним накануне</span>
      </div>
    </aside>
  );
}

export function PlanPageClient({ initialItems, ideaActivityIds, initialIdeas = [] }: Props) {
  const todayISO = getTodayISO();
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [items, setItems] = useState(initialItems);

  const itemsByDate = useMemo(() => {
    return items.reduce<Record<string, SerializedPlanItem[]>>((acc, item) => {
      if (!acc[item.date]) acc[item.date] = [];
      acc[item.date].push(item);
      return acc;
    }, {});
  }, [items]);

  const dayItems = itemsByDate[selectedDate] ?? [];
  const totalItems = items.length;
  const totalDays = Object.keys(itemsByDate).length;

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const hasIdeas = initialIdeas.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#F6F2EA" }}>
      <PlanProfileCompletionGate />

      {/* Breadcrumbs */}
      <Container>
        <div className="flex items-center gap-2 pt-6 pb-2" style={{ color: "rgba(20,18,16,.55)", fontSize: 13 }}>
          <Link href="/me" className="inline-flex items-center gap-1.5" style={{ color: "inherit" }}>
            ← Профиль
          </Link>
          <span style={{ opacity: 0.5 }}>→</span>
          <span style={{ color: "#141210" }}>Мой план</span>
        </div>
      </Container>

      {/* Hero */}
      <Container className="pt-6 pb-9">
        <div
          className="plan-hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr min(320px, 35%)",
            gap: 48,
            alignItems: "flex-end",
          }}
        >
          <div>
            <div className="flex items-center gap-3" style={{ marginBottom: 18, lineHeight: 1 }}>
              <span
                className="font-mono uppercase inline-flex items-center gap-1.5"
                style={{ fontSize: 11, letterSpacing: ".14em", color: "#C24E22" }}
              >
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#C24E22", flexShrink: 0 }} />
                МОЙ ПЛАН
              </span>
              <span
                className="font-mono uppercase"
                style={{ fontSize: 11, letterSpacing: ".14em", color: "rgba(20,18,16,.55)" }}
              >
                {MONTHS_RU[new Date().getMonth()]}
              </span>
            </div>
            <h1
              className="font-display"
              style={{
                margin: 0,
                fontSize: "clamp(56px, 8vw, 120px)",
                lineHeight: 0.92,
                letterSpacing: "-.03em",
                color: "#141210",
              }}
            >
              Мой план.
            </h1>
            <p style={{
              maxWidth: 520,
              marginTop: 22,
              marginBottom: 0,
              fontSize: 18,
              lineHeight: 1.5,
              color: "#3A332B",
            }}>
              Планируйте день и&nbsp;сохраняйте активности на&nbsp;нужные даты.
              Напомним накануне — чтобы ничего не&nbsp;потерялось.
            </p>
          </div>

          <div className="flex flex-col items-end">
            <div style={{
              padding: "14px 16px",
              background: "#FAF7F1",
              border: "1px solid rgba(20,18,16,.10)",
              borderRadius: 14,
              minWidth: 220,
              textAlign: "right",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}>
              <span
                className="font-mono uppercase"
                style={{ fontSize: 11, letterSpacing: ".14em", color: "#C24E22" }}
              >
                ● в плане
              </span>
              <div
                className="font-display"
                style={{ fontSize: 34, lineHeight: 1, letterSpacing: "-.02em", color: "#141210" }}
              >
                {totalItems} {pluralizeEvents(totalItems)}
              </div>
              <div
                className="font-mono uppercase"
                style={{ fontSize: 11, letterSpacing: ".06em", color: "rgba(20,18,16,.55)" }}
              >
                на {totalDays} {pluralizeDays(totalDays)}
                {ideaActivityIds.length > 0 ? ` · ${ideaActivityIds.length} идей` : ""}
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* Week Calendar */}
      <Container className="pb-12">
        <WeekCalendar
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          itemsByDate={itemsByDate}
        />
      </Container>

      {/* Main: day list + ideas sidebar */}
      <Container className="pb-20">
        <div
          className="plan-main-grid"
          style={{
            display: "grid",
            gridTemplateColumns: hasIdeas ? "1fr 300px" : "1fr",
            gap: 48,
            alignItems: "flex-start",
          }}
        >
          <PlanDayList
            date={selectedDate}
            items={dayItems}
            onRemove={handleRemoveItem}
          />
          {hasIdeas && <IdeasSidebar ideas={initialIdeas} />}
        </div>
      </Container>

      <style>{`
        @media (max-width: 900px) {
          .plan-hero-grid, .plan-main-grid {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
          .plan-hero-grid > div:last-child {
            align-items: flex-start !important;
          }
        }
      `}</style>
    </div>
  );
}
