"use client";

import { useEffect, useState } from "react";
import { RS, RsChip, RsChipRow, RsInput, RsSection } from "@/components/request/requestSheetKit";
import {
  BOOKING_CHILD_NAME_MAX,
  BOOKING_MAX_ADULTS,
  childAgeWarning,
  formatChildAge,
  type EventAgeRule,
} from "@/lib/booking/bookingParticipants";
import {
  canAddChild,
  clampAdults,
  parseManualAge,
  type ParticipantsDraft,
} from "./participantsDraft";

type ProfileChild = { id: string; name: string | null; age: number | null };

type Props = {
  value: ParticipantsDraft;
  onChange: (next: ParticipantsDraft) => void;
  /** Профиль запрашиваем только для вошедших; гостю — только ручной ввод. */
  isAuthenticated: boolean;
  ageRule?: EventAgeRule | null;
  /** Ошибки ручных детей по key (после попытки отправки). */
  errors?: Record<string, string>;
};

function profileChildLabel(child: ProfileChild): string {
  const name = child.name?.trim();
  if (name && child.age !== null) return `${name}, ${formatChildAge(child.age)}`;
  if (name) return name;
  return child.age !== null ? formatChildAge(child.age) : "Ребёнок";
}

let manualSeq = 0;

function Warning({ text }: { text: string }) {
  return (
    <p className="m-0 mt-1.5 text-xs font-semibold" style={{ color: "#8A5A00" }} role="status">
      {text}
    </p>
  );
}

/** Блок «Кого записываем»: взрослые, дети из профиля и ручные дети. Данные детей — только возраст и имя. */
export function BookingParticipantsField({ value, onChange, isAuthenticated, ageRule = null, errors = {} }: Props) {
  const [profile, setProfile] = useState<ProfileChild[]>([]);

  // Один запрос за детьми профиля — только для вошедших.
  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    fetch("/api/public/bookings/camp-shift/prefill", { credentials: "include", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { children?: ProfileChild[] } | null) => {
        if (json?.children) setProfile(json.children.map((c) => ({ id: c.id, name: c.name, age: c.age })));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [isAuthenticated]);

  const toggleProfile = (id: string) => {
    const selected = value.profileChildIds.includes(id);
    if (!selected && !canAddChild(value)) return;
    onChange({
      ...value,
      profileChildIds: selected ? value.profileChildIds.filter((x) => x !== id) : [...value.profileChildIds, id],
    });
  };

  const selectedProfile = profile.filter((child) => value.profileChildIds.includes(child.id));

  return (
    <RsSection
      label="Кого записываем"
      hint="Организатор увидит имя и возраст детей — больше ничего из вашего профиля."
    >
      <div className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-2.5" style={{ borderColor: RS.line2, background: "#fff" }}>
        <span className="text-[15px]" style={{ color: RS.ink }}>Взрослые</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Меньше взрослых"
            disabled={value.adults <= 1}
            onClick={() => onChange({ ...value, adults: clampAdults(value.adults - 1) })}
            className="h-10 w-10 rounded-full border text-lg disabled:opacity-40"
            style={{ borderColor: RS.line2 }}
          >
            −
          </button>
          <span className="min-w-6 text-center text-[16px] font-semibold" aria-live="polite">{value.adults}</span>
          <button
            type="button"
            aria-label="Больше взрослых"
            disabled={value.adults >= BOOKING_MAX_ADULTS}
            onClick={() => onChange({ ...value, adults: clampAdults(value.adults + 1) })}
            className="h-10 w-10 rounded-full border text-lg disabled:opacity-40"
            style={{ borderColor: RS.line2 }}
          >
            +
          </button>
        </div>
      </div>

      {profile.length > 0 ? (
        <div className="mt-3">
          <div className="mb-2 text-xs" style={{ color: RS.ink3 }}>Дети из профиля</div>
          <RsChipRow>
            {profile.map((child) => (
              <RsChip key={child.id} active={value.profileChildIds.includes(child.id)} onClick={() => toggleProfile(child.id)}>
                {profileChildLabel(child)}
              </RsChip>
            ))}
          </RsChipRow>
          {selectedProfile.map((child) => {
            const warning = childAgeWarning(child.age, ageRule);
            return warning ? <Warning key={child.id} text={`${child.name?.trim() || "Ребёнок"}: ${warning.toLowerCase()}`} /> : null;
          })}
        </div>
      ) : null}

      {value.manual.map((child, index) => {
        const age = parseManualAge(child.age);
        const warning = age !== null ? childAgeWarning(age, ageRule) : null;
        const error = age === null ? errors[child.key] : undefined;
        return (
          <div key={child.key} className="mt-3 rounded-2xl border p-3" style={{ borderColor: RS.line2, background: "#fff" }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs" style={{ color: RS.ink3 }}>Ребёнок {value.profileChildIds.length + index + 1}</span>
              <button
                type="button"
                onClick={() => onChange({ ...value, manual: value.manual.filter((m) => m.key !== child.key) })}
                className="text-xs font-semibold underline"
                style={{ color: RS.ink3 }}
              >
                Убрать
              </button>
            </div>
            <div className="grid grid-cols-[96px_1fr] gap-2">
              <RsInput
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="Возраст"
                aria-label="Возраст ребёнка"
                invalid={Boolean(error)}
                value={child.age}
                onChange={(e) =>
                  onChange({ ...value, manual: value.manual.map((m) => (m.key === child.key ? { ...m, age: e.target.value.replace(/\D/g, "") } : m)) })
                }
              />
              <RsInput
                type="text"
                maxLength={BOOKING_CHILD_NAME_MAX}
                placeholder="Имя (необязательно)"
                aria-label="Имя ребёнка"
                value={child.name}
                onChange={(e) =>
                  onChange({ ...value, manual: value.manual.map((m) => (m.key === child.key ? { ...m, name: e.target.value } : m)) })
                }
              />
            </div>
            {error ? <p role="alert" className="m-0 mt-1.5 text-xs font-semibold" style={{ color: RS.danger }}>{error}</p> : null}
            {warning ? <Warning text={warning} /> : null}
          </div>
        );
      })}

      {canAddChild(value) ? (
        <button
          type="button"
          onClick={() => onChange({ ...value, manual: [...value.manual, { key: `m${++manualSeq}`, age: "", name: "" }] })}
          className="mt-3 inline-flex min-h-10 items-center rounded-full border px-4 text-[13px] font-semibold"
          style={{ borderColor: RS.line2, color: RS.ink }}
        >
          + Добавить ребёнка
        </button>
      ) : null}
    </RsSection>
  );
}
