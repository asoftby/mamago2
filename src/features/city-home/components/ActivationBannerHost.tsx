"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Users, Sparkles } from "lucide-react";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { FamilyActivationAddChildOverlay } from "./FamilyActivationAddChildOverlay";
import { FamilyActivationEditChildBirthOverlay } from "./FamilyActivationEditChildBirthOverlay";
import { AdultActivationOverlay } from "./AdultActivationOverlay";
import { requestOpenMyPlan } from "@/lib/my-plan/myPlanOpenIntent";

// ── dismiss state ─────────────────────────────────────────────────────────────

const CHILD_SESSION_KEY = "mamago:childBannerDismissed";
const ADULT_LS_KEY = "mamago:adultBannerDismissCount";
const ADULT_MAX_DISMISS = 3;

const GUEST_BANNER_SESSION_KEY = "mamago:guestPlanBannerDismissed";

const childListeners = new Set<() => void>();
const adultListeners = new Set<() => void>();
const guestListeners = new Set<() => void>();

function getChildDismissed() {
  if (typeof window === "undefined") return false;
  try { return sessionStorage.getItem(CHILD_SESSION_KEY) === "1"; } catch { return false; }
}
function getAdultDismissCount() {
  if (typeof window === "undefined") return 0;
  try { return parseInt(localStorage.getItem(ADULT_LS_KEY) ?? "0", 10) || 0; } catch { return 0; }
}

function getGuestDismissed() {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(GUEST_BANNER_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeGuestDismiss(onStoreChange: () => void) {
  guestListeners.add(onStoreChange);
  return () => {
    guestListeners.delete(onStoreChange);
  };
}

// ── animation variants ────────────────────────────────────────────────────────

const smoothEase: [number, number, number, number] = [0.22, 1, 0.36, 1];
const exitEase: [number, number, number, number] = [0.4, 0, 1, 1];

const bannerVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.99 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.26, ease: smoothEase },
  },
  exit: {
    opacity: 0, y: -6, scale: 0.98,
    transition: { duration: 0.2, ease: exitEase },
  },
};

// ── shared banner shell ───────────────────────────────────────────────────────

function BannerShell({
  icon,
  title,
  description,
  ctaLabel,
  ctaStyle,
  onCta,
  onDismiss,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaLabel: string;
  ctaStyle: "primary" | "secondary";
  onCta: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="relative rounded-2xl border border-border bg-background px-5 py-4 sm:px-6">
      {/* dismiss */}
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/60 hover:text-neutral-600"
        aria-label="Скрыть"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>

      <div className="relative flex items-start gap-4 pr-8">
        {/* icon */}
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF3EC]">
          {icon}
        </div>

        {/* content */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="leading-snug text-neutral-900" style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: 18 }}>
            {title}
          </p>
          <p className="text-[14px] leading-[150%] text-neutral-600 sm:text-[14px]">
            {description}
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={onCta}
              className={
                ctaStyle === "primary"
                  ? "inline-flex h-10 items-center rounded-full bg-[#EF8759] px-5 text-sm font-semibold text-white transition-all hover:bg-primary-hover active:scale-[0.97]"
                  : "inline-flex h-9 items-start rounded-full border border-neutral-200 bg-white px-4 pt-[7px] text-sm font-medium text-neutral-700 transition-all hover:border-neutral-300 hover:bg-neutral-50 active:scale-[0.97]"
              }
            >
              {ctaLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── host ──────────────────────────────────────────────────────────────────────

export function ActivationBannerHost() {
  const family = useFamilyPersona();

  // dismiss state — useSyncExternalStore для реактивности
  const childDismissed = useSyncExternalStore(
    (cb) => { childListeners.add(cb); return () => childListeners.delete(cb); },
    getChildDismissed,
    () => false,
  );
  const adultDismissCount = useSyncExternalStore(
    (cb) => { adultListeners.add(cb); return () => adultListeners.delete(cb); },
    getAdultDismissCount,
    () => 0,
  );
  const guestDismissed = useSyncExternalStore(
    subscribeGuestDismiss,
    getGuestDismissed,
    () => false,
  );

  const [childOpen, setChildOpen] = useState(false);
  const [editBirthOpen, setEditBirthOpen] = useState(false);
  const [adultOpen, setAdultOpen] = useState(false);

  const loading = family?.loading ?? true;
  const menuUser = family?.menuUser ?? null;
  const hasChildren = (family?.childPersonasForFilter.length ?? 0) > 0;
  const childMissingBirth = family?.childPersonasForFilter.find((child) => !child.birthDate) ?? null;
  const isAdultComplete = !!(
    menuUser?.familyRole ||
    (menuUser?.preferenceSignalIds?.length ?? 0) > 0
  );

  // which banner to show
  const showChild = !loading && !!menuUser && (!hasChildren || !!childMissingBirth) && !childDismissed;
  const showAdult =
    !loading && !!menuUser && hasChildren && !childMissingBirth && !isAdultComplete && adultDismissCount < ADULT_MAX_DISMISS;

  const activeBanner: "child" | "adult" | null = showChild
    ? "child"
    : showAdult
      ? "adult"
      : null;

  const dismissChild = useCallback(() => {
    try { sessionStorage.setItem(CHILD_SESSION_KEY, "1"); } catch { /* ignore */ }
    childListeners.forEach((fn) => fn());
  }, []);

  const dismissAdult = useCallback(() => {
    try {
      localStorage.setItem(ADULT_LS_KEY, String(getAdultDismissCount() + 1));
    } catch { /* ignore */ }
    adultListeners.forEach((fn) => fn());
  }, []);

  const dismissGuest = useCallback(() => {
    try {
      sessionStorage.setItem(GUEST_BANNER_SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    guestListeners.forEach((fn) => fn());
  }, []);

  const handleChildSuccess = useCallback(async () => {
    await family?.refresh();
  }, [family]);

  const handleAdultSuccess = useCallback(async () => {
    await family?.refresh();
  }, [family]);

  if (loading) return null;

  if (!menuUser) {
    if (guestDismissed) return null;
    return (
      <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-brand/25 px-4 py-3 shadow-[0_1px_0_color-mix(in_srgb,var(--brand)_10%,transparent),0_12px_32px_-12px_color-mix(in_srgb,var(--brand)_35%,transparent)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-mg-banner-gradient-flow"
          style={{
            backgroundImage:
              "linear-gradient(115deg, color-mix(in srgb, var(--brand) 18%, white) 0%, color-mix(in srgb, var(--brand) 38%, white) 18%, color-mix(in srgb, var(--brand) 55%, white) 34%, color-mix(in srgb, #F2B8A0 55%, white) 48%, color-mix(in srgb, var(--brand) 48%, white) 62%, color-mix(in srgb, #FFD7A8 45%, white) 78%, color-mix(in srgb, var(--brand) 22%, white) 100%)",
            backgroundSize: "240% 240%",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-10 -top-12 size-44 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--brand)_48%,transparent),transparent_68%)] blur-2xl animate-mg-banner-orb-drift"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-14 -right-8 size-48 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,#FFD7A8_70%,transparent),transparent_66%)] blur-2xl animate-mg-banner-orb-drift-reverse"
        />
        <p className="relative z-[1] min-w-0 flex-1 text-sm text-foreground">
          Хотите готовый план на день?
        </p>
        <button
          type="button"
          onClick={() => requestOpenMyPlan()}
          className="relative z-[1] shrink-0 min-h-11 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Хочу
        </button>
        <button
          type="button"
          onClick={dismissGuest}
          aria-label="Скрыть подсказку"
          className="relative z-[1] shrink-0 inline-flex size-9 items-center justify-center rounded-full text-brand-ink/70 transition-colors hover:bg-white/50 hover:text-brand-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {activeBanner === "child" && (
          <motion.div
            key="child"
            variants={bannerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <BannerShell
              icon={<Users className="h-5 w-5 text-[#EF8759]" strokeWidth={1.75} />}
              title={childMissingBirth ? "Уточните возраст ребёнка" : "Подберём события для вашей семьи"}
              description={childMissingBirth
                ? "Укажите месяц и год рождения — рекомендации станут точнее."
                : "Добавьте ребёнка, чтобы видеть подходящие ему мероприятия."}
              ctaLabel={childMissingBirth ? "Указать возраст" : "Добавить ребёнка"}
              ctaStyle="primary"
              onCta={() => childMissingBirth ? setEditBirthOpen(true) : setChildOpen(true)}
              onDismiss={dismissChild}
            />
          </motion.div>
        )}

        {activeBanner === "adult" && (
          <motion.div
            key="adult"
            variants={bannerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <BannerShell
              icon={<Sparkles className="h-5 w-5 text-[#EF8759]" strokeWidth={1.75} />}
              title="Сделаем рекомендации ещё точнее"
              description="Добавьте информацию о себе — учтём формат отдыха, интересы и бюджет"
              ctaLabel="Настроить"
              ctaStyle="secondary"
              onCta={() => setAdultOpen(true)}
              onDismiss={dismissAdult}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <FamilyActivationAddChildOverlay
        open={childOpen}
        onOpenChange={setChildOpen}
        onSuccess={handleChildSuccess}
      />
      <FamilyActivationEditChildBirthOverlay
        open={editBirthOpen}
        onOpenChange={setEditBirthOpen}
        child={childMissingBirth}
        onSuccess={handleChildSuccess}
      />
      <AdultActivationOverlay
        open={adultOpen}
        onOpenChange={setAdultOpen}
        onSuccess={handleAdultSuccess}
      />
    </>
  );
}
