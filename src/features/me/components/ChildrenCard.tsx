"use client";

import { useEffect, useState } from "react";
import { Users, Pencil, Plus } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { H2, BodyMuted } from "@/components/ui/typography";
import { AddChildModal } from "@/components/children/AddChildModal";
import { getSystemInterestLabel } from "@/lib/config/interests";
import { cn } from "@/lib/utils";

export interface ChildData {
  id: string;
  name: string;
  birthDate: Date | null;
  systemInterests?: { interestSlug: string }[];
  customInterests?: { label: string }[];
}

/** Данные для карточки взрослого (без смены бизнес-логики — опциональные поля с сервера в будущем). */
export type AdultPersonaProps = {
  displayName?: string | null;
  avatarUrl?: string | null;
  /** Буква в аватаре, если нет фото */
  initialChar: string;
  /** например «Мама», «Папа» */
  roleLabel?: string | null;
  /** например «25–34» */
  ageBandLabel?: string | null;
  /** Legacy свободный текст (если нет signal-полей) */
  preferenceSummary?: string | null;
  leisureFormatSummary?: string | null;
  /** Готовая строка с сервера (signals + legacy) */
  preferenceDisplayLine?: string | null;
};

const CARD_W =
  "w-[min(100%,var(--family-card-w))] min-w-[184px] max-w-[230px] shrink-0 sm:w-[207px]";
const AVATAR =
  "h-12 w-12 rounded-full shrink-0 flex items-center justify-center text-base font-semibold leading-none";
const ROW_SCROLL =
  "flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1 scroll-smooth snap-x snap-mandatory sm:snap-none";
const TRANSITION = "transition-all duration-200 ease-out";

/** Карточка участника: полупрозрачное «стекло» + blur (читается на фоне Surface). */
const GLASS_MEMBER_CARD = cn(
  "group relative text-left rounded-2xl border px-4 py-3.5",
  "border-white/60 bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_36px_-10px_rgba(15,23,42,0.1)]",
  "backdrop-blur-xl backdrop-saturate-150",
  TRANSITION,
  "hover:border-white/80 hover:bg-white/48 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_14px_44px_-12px_rgba(15,23,42,0.12)]",
  "active:scale-[0.99] active:bg-white/30",
  "cursor-pointer snap-start",
);

const GLASS_ADD_CARD = cn(
  "flex items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-3.5",
  "border-white/45 bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-lg backdrop-saturate-150",
  TRANSITION,
  "text-neutral-500 hover:border-primary/40 hover:bg-primary/[0.12] hover:text-primary hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_8px_28px_-8px_rgba(239,135,89,0.18)]",
  "active:scale-[0.99] cursor-pointer snap-start",
);

function getAgeLine(birthDate: Date | null): string {
  if (!birthDate || Number.isNaN(birthDate.getTime())) return "Возраст не указан";
  const now = new Date();
  const months =
    (now.getFullYear() - birthDate.getFullYear()) * 12 +
    (now.getMonth() - birthDate.getMonth());
  if (months < 12) return `${months} мес.`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"}`;
}

function formatChildInterests(child: ChildData): string {
  const system =
    child.systemInterests?.map((i) => getSystemInterestLabel(i.interestSlug)) ?? [];
  const custom = child.customInterests?.map((c) => c.label) ?? [];
  const all = [...system, ...custom].filter(Boolean);
  if (all.length === 0) return "Добавьте интересы";
  const max = 3;
  const slice = all.slice(0, max);
  const line = slice.join(" · ");
  return all.length > max ? `${line}…` : line;
}

function adultTitle(adult: AdultPersonaProps): string {
  const n = adult.displayName?.trim();
  return n ? n : "Я";
}

function adultSubtitle(adult: AdultPersonaProps): string {
  const role = adult.roleLabel?.trim();
  const age = adult.ageBandLabel?.trim();
  if (role && age) return `${role} · ${age}`;
  if (role) return role;
  if (age) return age;
  return "Родитель";
}

function adultPreferenceLine(adult: AdultPersonaProps): string {
  const precomputed = adult.preferenceDisplayLine?.trim();
  if (precomputed) return precomputed;
  const p = adult.preferenceSummary?.trim();
  const l = adult.leisureFormatSummary?.trim();
  if (p && l) return `${p} · ${l}`;
  if (p) return p;
  if (l) return l;
  return "Настроим рекомендации";
}

export function ChildrenCard({
  adult,
  children: childrenList,
}: {
  adult: AdultPersonaProps;
  children: ChildData[];
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<ChildData | undefined>();
  const [editingAdult, setEditingAdult] = useState(false);
  const [highlightChildId, setHighlightChildId] = useState<string | null>(null);
  const [highlightAdult, setHighlightAdult] = useState(false);

  useEffect(() => {
    if (!highlightChildId) return;
    const t = setTimeout(() => setHighlightChildId(null), 2200);
    return () => clearTimeout(t);
  }, [highlightChildId]);

  useEffect(() => {
    if (!highlightAdult) return;
    const t = setTimeout(() => setHighlightAdult(false), 2200);
    return () => clearTimeout(t);
  }, [highlightAdult]);

  const openAdd = () => {
    setEditingChild(undefined);
    setEditingAdult(false);
    setIsModalOpen(true);
  };
  const openEditChild = (child: ChildData) => {
    setEditingChild(child);
    setEditingAdult(false);
    setIsModalOpen(true);
  };
  const openEditAdult = () => {
    setEditingChild(undefined);
    setEditingAdult(true);
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingChild(undefined);
    setEditingAdult(false);
  };

  const hasChildren = childrenList.length > 0;

  return (
    <>
      <Surface variant="elevated" className="p-6 [--family-card-w:230px]">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="h-5 w-5 text-primary shrink-0" aria-hidden />
            <H2 className="truncate">Моя семья</H2>
          </div>
        </div>

        <BodyMuted className="text-sm text-neutral-500 mb-4 max-w-xl">
          Контекст семьи помогает подбирать события и маршруты под вас.
        </BodyMuted>

        <div className={ROW_SCROLL}>
          {/* 1. Взрослый */}
          <button
            type="button"
            onClick={openEditAdult}
            className={cn(
              CARD_W,
              GLASS_MEMBER_CARD,
              highlightAdult && "animate-in fade-in zoom-in-95 duration-300",
            )}
            aria-label="Редактировать профиль взрослого"
          >
            <span
              className={cn(
                "absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-xl",
                "text-neutral-500 hover:text-neutral-800 bg-white/40 backdrop-blur-sm hover:bg-white/60",
                "opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150",
              )}
              aria-hidden
            >
              <Pencil className="h-3.5 w-3.5" />
            </span>
            <div className="flex items-center gap-3 pr-7">
              <div
                className={cn(
                  AVATAR,
                  "bg-white/55 text-primary backdrop-blur-sm overflow-hidden ring-1 ring-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
                )}
              >
                {adult.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={adult.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    {adult.initialChar.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900 truncate">
                  {adultTitle(adult)}
                </p>
                <p className="text-xs text-neutral-500 truncate whitespace-nowrap mt-0.5">
                  {adultSubtitle(adult)}
                </p>
                <p className="text-xs text-neutral-400 truncate whitespace-nowrap mt-1">
                  {adultPreferenceLine(adult)}
                </p>
              </div>
            </div>
          </button>

          {/* 2. Дети */}
          {childrenList.map((child) => {
            const interests = formatChildInterests(child);
            return (
              <button
                key={child.id}
                type="button"
                onClick={() => openEditChild(child)}
                className={cn(
                  CARD_W,
                  GLASS_MEMBER_CARD,
                  highlightChildId === child.id &&
                    "animate-in fade-in zoom-in-95 duration-300",
                )}
                aria-label={`Редактировать ${child.name}`}
              >
                <span
                  className={cn(
                    "absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-xl",
                    "text-neutral-500 hover:text-neutral-800 bg-white/40 backdrop-blur-sm hover:bg-white/60",
                    "opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150",
                  )}
                  aria-hidden
                >
                  <Pencil className="h-3.5 w-3.5" />
                </span>
                <div className="flex items-center gap-3 pr-7">
                  <div
                    className={cn(
                      AVATAR,
                      "bg-gradient-to-br from-white/70 via-primary/12 to-primary/25 text-primary backdrop-blur-sm ring-1 ring-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]",
                    )}
                  >
                    <span className="flex h-full w-full items-center justify-center">
                      {child.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-neutral-900 truncate whitespace-nowrap">
                      {child.name} · {getAgeLine(child.birthDate ? new Date(child.birthDate) : null)}
                    </p>
                    <p className="text-xs text-neutral-400 truncate whitespace-nowrap mt-1">
                      {interests}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

          {/* 3. Добавить участника */}
          <button
            type="button"
            onClick={openAdd}
            className={cn(CARD_W, GLASS_ADD_CARD)}
            aria-label="Добавить участника"
          >
            <div
              className={cn(
                AVATAR,
                "border-2 border-dashed border-current/80 bg-white/25 text-current backdrop-blur-sm",
              )}
            >
              <Plus className="h-5 w-5 stroke-[2.5]" />
            </div>
            <span className="text-sm font-medium leading-tight">Добавить участника</span>
          </button>
        </div>

        {!hasChildren ? (
          <p className="mt-4 text-xs text-neutral-400 text-center sm:text-left">
            Пока нет детей в профиле — нажмите «Добавить участника», чтобы добавить ребёнка.
          </p>
        ) : null}
      </Surface>

      <AddChildModal
        isOpen={isModalOpen}
        onClose={closeModal}
        childData={editingChild}
        editAdult={editingAdult}
        onSaved={(p) => {
          if (p.kind === "child" && p.childId) setHighlightChildId(p.childId);
          if (p.kind === "adult") setHighlightAdult(true);
        }}
      />
    </>
  );
}
