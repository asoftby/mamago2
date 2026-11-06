"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { cn } from "@/lib/utils";
import {
  ageMonthsFromBirthDate,
  kidsFromGuestYears,
  orderCollection,
  reasonFor,
  type OrderKid,
} from "@/lib/article/collectionPersonalOrder";

export type CollectionListItem = {
  id: string;
  title: string;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  node: ReactNode;
};

const GUEST_AGES_KEY = "mamago:collection-guest-ages";
const GUEST_AGE_OPTIONS = Array.from({ length: 15 }, (_, i) => i);

const GUEST_AGES_EVENT = "mamago:collection-guest-ages";

function parseGuestAges(raw: string): number[] {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? parsed.filter((x): x is number => Number.isInteger(x) && x >= 0 && x <= 14) : [];
  } catch {
    return [];
  }
}

function subscribeGuestAges(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(GUEST_AGES_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(GUEST_AGES_EVENT, cb);
  };
}

function readGuestAgesRaw(): string {
  try {
    return localStorage.getItem(GUEST_AGES_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeGuestAges(ages: number[]) {
  try {
    if (ages.length) localStorage.setItem(GUEST_AGES_KEY, JSON.stringify(ages));
    else localStorage.removeItem(GUEST_AGES_KEY);
  } catch {
    /* хранилище недоступно — выбор не сохранится */
  }
  window.dispatchEvent(new Event(GUEST_AGES_EVENT));
}

const chipBase = "inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold";

function Plaque({ children, title, hint }: { children?: ReactNode; title: string; hint: string }) {
  return (
    <section aria-label="Персональный порядок" className="not-prose mb-5 rounded-[22px] border border-[rgba(20,18,16,.1)] bg-[#FAF7F1] p-4 font-sans text-[#141210]">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#FFE8DC] text-[#C24E22]">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <div>
          <b className="block text-base font-semibold leading-snug">{title}</b>
          <span className="mt-0.5 block text-[13.5px] text-[#6B6259]">{hint}</span>
        </div>
      </div>
      {children}
    </section>
  );
}

export function CollectionPersonalList({ items }: { items: CollectionListItem[] }) {
  const persona = useFamilyPersona();
  const [sel, setSel] = useState<string>("all");
  // Выбор гостя хранится только на устройстве; на сервере и при гидратации — пусто.
  const guestAgesRaw = useSyncExternalStore(subscribeGuestAges, readGuestAgesRaw, () => "");
  const guestAges = useMemo(() => parseGuestAges(guestAgesRaw), [guestAgesRaw]);
  const [pick, setPick] = useState<number[]>([]);
  const [askOpen, setAskOpen] = useState(false);

  const familyKids = useMemo<OrderKid[]>(() => {
    if (!persona) return [];
    const now = new Date();
    return persona.personas.flatMap((p) => {
      if (p.kind !== "child") return [];
      const ageMonths = ageMonthsFromBirthDate(p.birthDate, now);
      return ageMonths == null ? [] : [{ id: p.id, name: p.displayName, ageMonths }];
    });
  }, [persona]);

  const isFamily = familyKids.length > 0;
  const activeKids = useMemo<OrderKid[]>(() => {
    if (isFamily) return sel === "all" ? familyKids : familyKids.filter((k) => k.id === sel);
    return kidsFromGuestYears(guestAges);
  }, [isFamily, familyKids, sel, guestAges]);

  const ordered = useMemo(() => orderCollection(items, activeKids), [items, activeKids]);

  // FLIP: карточки плавно переезжают на новые места — видно, что это сортировка, а не другой список.
  const nodes = useRef(new Map<string, HTMLElement>());
  const tops = useRef(new Map<string, number>());
  const snapshot = useCallback(() => {
    tops.current = new Map([...nodes.current].map(([id, el]) => [id, el.getBoundingClientRect().top]));
  }, []);
  const orderKey = ordered.map((i) => i.id).join();
  useLayoutEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      tops.current.clear();
      return;
    }
    nodes.current.forEach((el, id) => {
      const prev = tops.current.get(id);
      if (prev == null) return;
      const dy = prev - el.getBoundingClientRect().top;
      if (Math.abs(dy) > 2) el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 560, easing: "cubic-bezier(.32,.72,0,1)" });
    });
    tops.current.clear();
  }, [orderKey]);

  const changeSel = (next: string) => {
    snapshot();
    setSel(next);
  };
  const applyGuest = (ages: number[]) => {
    snapshot();
    writeGuestAges(ages);
    setAskOpen(false);
  };

  let plaque: ReactNode;
  if (isFamily) {
    const options = [{ id: "all", label: "Всем вместе" }, ...familyKids.map((k) => ({ id: k.id, label: k.name || "Ребёнок" }))];
    plaque = (
      <Plaque title="Порядок подобран под вашу семью" hint="Состав подборки у всех одинаковый">
        <div role="radiogroup" aria-label="Под кого упорядочить" className="-mx-4 mt-3.5 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={sel === o.id}
              onClick={() => changeSel(o.id)}
              className={cn(chipBase, sel === o.id ? "border-[#141210] bg-[#141210] text-white" : "border-[rgba(20,18,16,.18)] bg-white hover:border-[#141210]")}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Plaque>
    );
  } else if (guestAges.length) {
    plaque = (
      <Plaque
        title={`Порядок подобран под возраст ${guestAges.map((a) => (a === 0 ? "до года" : a)).join(" и ")}`}
        hint="Состав подборки у всех одинаковый"
      >
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <button type="button" className="min-h-11 text-sm font-semibold text-[#C24E22]" onClick={() => applyGuest([])}>Сбросить</button>
        </div>
      </Plaque>
    );
  } else {
    plaque = (
      <Plaque
        title={askOpen ? "Сколько лет детям?" : "Укажите возраст детей"}
        hint={askOpen ? "Можно выбрать несколько" : "Покажем, что подойдёт вам лучше. Состав подборки не изменится — только порядок."}
      >
        {!askOpen ? (
          <button type="button" onClick={() => setAskOpen(true)} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-[#141210] px-[18px] text-sm font-semibold text-white">
            Указать возраст
          </button>
        ) : (
          <>
            <div role="group" aria-label="Возраст" className="mt-3 grid grid-cols-5 gap-1.5">
              {GUEST_AGE_OPTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={pick.includes(a)}
                  onClick={() => setPick((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a].sort((x, y) => x - y)))}
                  className={cn("min-h-11 rounded-xl border text-[15px] font-semibold", pick.includes(a) ? "border-[#141210] bg-[#141210] text-white" : "border-[rgba(20,18,16,.18)] bg-white hover:border-[#141210]")}
                >
                  {a === 0 ? "<1" : a}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-4">
              <button type="button" disabled={!pick.length} onClick={() => applyGuest(pick)} className="inline-flex min-h-11 items-center rounded-full bg-[#141210] px-[18px] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#E4DDD2] disabled:text-[#6B6259]">
                Показать
              </button>
              <button type="button" className="min-h-11 text-sm font-semibold text-[#C24E22]" onClick={() => setAskOpen(false)}>Не сейчас</button>
            </div>
            <p className="m-0 mt-2 text-[12.5px] leading-snug text-[#6B6259]">Сохраним только на этом устройстве.</p>
          </>
        )}
      </Plaque>
    );
  }

  return (
    <div>
      {plaque}
      <div className="flex flex-col gap-[22px] md:gap-7">
        {ordered.map((item) => {
          const reason = activeKids.length ? reasonFor(item, activeKids) : null;
          return (
            <div
              key={item.id}
              id={`o-${item.id}`}
              ref={(el) => {
                if (el) nodes.current.set(item.id, el);
                else nodes.current.delete(item.id);
              }}
            >
              {reason ? (
                <div className="not-prose mb-2.5 inline-flex max-w-full items-center rounded-full bg-[#E0EEE5] px-3.5 py-1.5 text-[13.5px] font-semibold text-[#24563F]">{reason.text}</div>
              ) : null}
              {item.node}
            </div>
          );
        })}
      </div>
    </div>
  );
}
