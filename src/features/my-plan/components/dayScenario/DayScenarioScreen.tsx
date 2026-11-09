"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlanScreenHeader } from "../v3/PlanScreenHeader";
import {
  PLAN_CHIP,
  PLAN_CHIP_OFF,
  PLAN_CHIP_ON,
  PLAN_FOCUS,
  PLAN_SEG,
  PLAN_SEG_BTN,
  PLAN_SEG_OFF,
  PLAN_SEG_ON,
} from "../v3/planChipStyles";
import { useDayScenarioDraft } from "../../hooks/useDayScenarioDraft";
import { useDayScenarioSave } from "../../hooks/useDayScenarioSave";
import { appendMyPlanOpenToHref, requestPlanRefetchForDate } from "@/lib/my-plan/myPlanOpenIntent";
import { buildAuthUrl } from "@/lib/auth/redirectTo";
import { getOrCreateAnonymousId } from "@/lib/anonymous/clientAnonymousId";
import { writeGuestDayScenarioDraft } from "@/lib/my-plan/guestDayScenarioDraft";
import { invalidatePlanDayMarkers } from "@/features/plan-calendar/usePlanDayCounts";
import { toast } from "@/lib/toast";
import {
  MAX_TARGET_COUNT,
  canGoBack,
  datesForChoice,
  dayTabLabel,
  dayTitle,
  freshItemOf,
  initialPersonSelection,
  rangesForAnswers,
  SAVE_FAILURE_TEXT,
  saveLabel,
  summaryLine,
  type DraftItem,
  type ScenarioMode,
  type WhenChoice,
} from "../../lib/dayScenarioUi/model";
import { ScenarioParams } from "./ScenarioParams";
import { ScenarioItemPreview } from "./ScenarioItemPreview";
import { ScenarioReplaceScreen, type ReplaceOption } from "./ScenarioReplaceScreen";
import { ScenarioStackLayer } from "./ScenarioStackLayer";
import { AllShown, DraftError, DraftSkeleton, EmptyResult, FewNearbyBanner } from "./ScenarioStates";
import { ScenarioTimeline, type OwnPlanEntry } from "./ScenarioTimeline";

export type ScenarioPerson = { id: string; label: string; kind: "adult" | "child" };

/**
 * The screens stacked over the draft. A card opens its preview; «Заменить» opens the alternatives,
 * and an alternative opens its own preview, where it can be taken.
 */
type StackView =
  | { kind: "preview"; item: DraftItem }
  | { kind: "replace" }
  | { kind: "pick"; option: ReplaceOption };

const PRIMARY_BTN = `mp-font-ui flex min-h-[62px] w-full items-center justify-center gap-2 rounded-full bg-[var(--mp-tx)] px-6 text-[18px] font-semibold text-[var(--surface)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${PLAN_FOCUS}`;
const QUIET_BTN = `mp-font-ui flex min-h-[52px] items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--mp-line-strong)] bg-[var(--surface)] px-2.5 text-[14px] font-semibold text-[var(--mp-tx)] transition-colors hover:border-[var(--mp-tx)] disabled:cursor-not-allowed disabled:opacity-40 ${PLAN_FOCUS}`;

/**
 * «Собрать день»: the draft screen of the day scenario (BACKLOG-230, PR 2). Shown by the plan
 * widget instead of «Подобрать, куда сходить» when DAY_SCENARIO_ENGINE_ENABLED is on.
 * A guest answers two questions first (when, children's ages); a member gets the draft at once
 * and tunes it with «С кем идём?». Draft only: saving the day is PR 3.
 */
export function DayScenarioScreen({
  audience,
  city,
  todayIso,
  initialDate,
  people = [],
  initialPersonaIds = [],
  ownEntries = [],
  hasPlanItems = false,
  seed = null,
  onBack,
  onClose,
}: {
  audience: "guest" | "member";
  /** City slug of the page the screen was opened on. */
  city: string;
  todayIso: string;
  /** Member: the day open in the widget. */
  initialDate: string;
  people?: ScenarioPerson[];
  /** The page's "Для кого?" choice: the screen opens with the same people picked. */
  initialPersonaIds?: string[];
  ownEntries?: OwnPlanEntry[];
  hasPlanItems?: boolean;
  /** «Изменить день»: the saved points of the open day; the draft starts from them (all pinned). */
  seed?: { kind: "event" | "place"; activityId: string; startsAt: string }[] | null;
  onBack: () => void;
  onClose?: () => void;
}) {
  const isGuest = audience === "guest";
  const [phase, setPhase] = useState<"params" | "draft">(isGuest ? "params" : "draft");
  const [when, setWhen] = useState<WhenChoice>("weekend");
  const [otherIso, setOtherIso] = useState<string | null>(null);
  const [ageKeys, setAgeKeys] = useState<string[]>([]);
  const [guestDates, setGuestDates] = useState<string[]>([]);
  const [mode, setMode] = useState<ScenarioMode>("car");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => initialPersonSelection(people.map((person) => person.id), initialPersonaIds));
  const [activeIdx, setActiveIdx] = useState(0);

  const [guestId, setGuestId] = useState<string | null>(null);
  useEffect(() => {
    if (isGuest) setGuestId(getOrCreateAnonymousId() || null);
  }, [isGuest]);

  const dates = useMemo(() => (isGuest ? guestDates : [initialDate]), [isGuest, guestDates, initialDate]);
  const activeDate = dates[Math.min(activeIdx, Math.max(0, dates.length - 1))] ?? null;
  const everyone = useMemo(() => people.map((person) => person.id), [people]);
  const personaIds = isGuest ? [] : selectedIds.length > 0 ? selectedIds : everyone;

  const api = useDayScenarioDraft({
    // A guest's first build waits for the anonymous id: the server counts the first build of each date per guest.
    enabled: phase === "draft" && dates.length > 0 && (!isGuest || guestId !== null),
    city,
    dates,
    mode,
    ageRanges: isGuest ? rangesForAnswers(ageKeys) : [],
    personaIds,
    seed,
    anonymousId: guestId ?? undefined,
  });
  const saver = useDayScenarioSave();
  const state = activeDate ? api.byDate[activeDate] : undefined;
  const current = state?.history.current ?? null;
  const loading = phase === "draft" && (state?.loading ?? !state);
  const items = current?.items ?? [];

  // The stack of screens over the draft, and the state of "Чем заменить?" (its screen is one of them).
  const [views, setViews] = useState<StackView[]>([]);
  const [replacing, setReplacing] = useState<DraftItem | null>(null);
  const [options, setOptions] = useState<ReplaceOption[] | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const replaceToken = useRef(0);

  const openReplace = async (item: DraftItem) => {
    if (!activeDate) return;
    const mine = ++replaceToken.current;
    setViews((prev) => [...prev, { kind: "replace" }]);
    setReplacing(item);
    setOptions(null);
    setOptionsLoading(true);
    const variants = await api.loadAlternatives(activeDate, item.activityId);
    if (replaceToken.current !== mine) return;
    const currentIds = new Set(items.map((i) => i.activityId));
    const found = (variants ?? [])
      .map((variantItems) => {
        const fresh = freshItemOf(variantItems, currentIds, item.activityId);
        return fresh ? { fresh, items: variantItems } : null;
      })
      .filter((option): option is ReplaceOption => option !== null);
    setOptions(found);
    setOptionsLoading(false);
  };
  const closeReplace = () => {
    replaceToken.current += 1;
    setReplacing(null);
    setOptions(null);
    setOptionsLoading(false);
  };
  /** One screen back; leaving the alternatives forgets them (a late answer is dropped by the token). */
  const popView = () => {
    const top = views[views.length - 1];
    if (!top) return;
    if (top.kind === "replace") closeReplace();
    setViews((prev) => prev.slice(0, -1));
  };
  const closeStack = () => {
    closeReplace();
    setViews([]);
  };
  // A screen of the stack is about a point of the draft. If the draft changes under it and that point is
  // gone (another variant, removed elsewhere), the stack closes: its buttons would act on an obsolete id.
  const stackTargets = views.flatMap((view) => (view.kind === "preview" ? [view.item.activityId] : []));
  const staleStack = stackTargets.some((id) => !items.some((it) => it.activityId === id)) || (replacing !== null && views.length > 0 && !items.some((it) => it.activityId === replacing.activityId));
  useEffect(() => {
    if (staleStack) closeStack();
    // closeStack only resets local state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staleStack]);
  const pickOption = (option: ReplaceOption) => {
    if (activeDate) api.chooseAlternative(activeDate, option.items);
    closeStack();
  };

  const toggleAge = (key: string) => setAgeKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const paramsReady = ageKeys.length > 0 && (when !== "other" || otherIso !== null);
  const submitParams = () => {
    if (!paramsReady) return;
    setGuestDates(datesForChoice(when, todayIso, otherIso));
    setActiveIdx(0);
    setPhase("draft");
  };
  const togglePerson = (id: string | null) =>
    setSelectedIds((prev) => (id === null ? [] : prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleBack = () => {
    if (isGuest && phase === "draft") setPhase("params");
    else onBack();
  };

  // Members save the open day. A guest has no plan to save into until the sign-in flow of PR 3c.
  const saving = saver.state.status === "saving";
  const canSave = !isGuest && Boolean(activeDate) && items.length > 0 && !loading && !saving;
  const saveDay = async () => {
    if (!activeDate || !canSave) return;
    const ok = await saver.save([{ date: activeDate, items, keep: api.kept }]);
    if (!ok) return;
    invalidatePlanDayMarkers();
    requestPlanRefetchForDate(activeDate);
    toast.success(seed ? "День обновлён" : "День сохранён в план");
    onBack();
  };
  // A guest's «Сохранить»: the shown day(s) wait in this browser, the guest signs in or registers, and the post-auth step
  // saves them (one save, once). Without storage nothing is lost silently: the guest is told.
  const guestSaveDays = dates.map((date) => ({ date, items: api.byDate[date]?.history.current?.items ?? [] })).filter((day) => day.items.length > 0);
  const canGuestSave = isGuest && phase === "draft" && guestSaveDays.length > 0 && !loading;
  const saveAsGuest = () => {
    if (!canGuestSave) return;
    const stored = writeGuestDayScenarioDraft(guestSaveDays, (() => { try { return window.localStorage; } catch { return null; } })(), Date.now(), `gd-${crypto.randomUUID()}`);
    if (!stored) {
      toast.error("Не удалось подготовить сохранение", { description: "Разрешите хранение данных в браузере и попробуйте ещё раз." });
      return;
    }
    const here = `${window.location.pathname}${window.location.search}`;
    window.location.assign(buildAuthUrl({ redirectTo: appendMyPlanOpenToHref(here) }));
  };
  const authHref = buildAuthUrl({ redirectTo: typeof window === "undefined" ? undefined : appendMyPlanOpenToHref(`${window.location.pathname}${window.location.search}`) });
  const saveError = saver.state.status === "error" ? SAVE_FAILURE_TEXT[saver.state.failure] : null;

  const title = phase === "params" ? "Куда сходить?" : dates.length > 1 ? "Выходные" : activeDate ? dayTitle(activeDate) : "Куда сходить?";
  const kicker = phase === "params" ? "Собрать день" : "Собрали за вас";
  const walking = mode === "walk";
  const showFewNearby = current?.status === "few_nearby" && (current.suggestMode === "car" || walking) && items.length > 0;
  const showEmpty = Boolean(current) && !loading && items.length === 0;
  const exhausted = state?.history.exhausted ?? false;

  return (
    <div className="relative h-full min-h-0 bg-[var(--mp-bg)]">
      {/* The draft stays mounted under the stack (scroll, filters, history survive) but is inert while a screen is over it. */}
      <div className="flex h-full min-h-0 flex-col" inert={views.length > 0} aria-hidden={views.length > 0 ? true : undefined}>
      <PlanScreenHeader kicker={kicker} title={title} onBack={handleBack} onClose={onClose} backLabel={isGuest && phase === "draft" ? "Назад к вопросам" : "Назад в план"} />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-40 pt-0 md:px-8">
        {phase === "params" ? (
          <ScenarioParams when={when} onWhen={setWhen} otherIso={otherIso} onOtherIso={setOtherIso} todayIso={todayIso} ageKeys={ageKeys} onToggleAge={toggleAge} />
        ) : (
          <>
            {dates.length > 1 ? (
              <div role="tablist" aria-label="День выходных" className={cn(PLAN_SEG, "mb-3")}>
                {dates.map((date, index) => (
                  <button
                    key={date}
                    type="button"
                    role="tab"
                    aria-selected={index === activeIdx}
                    onClick={() => setActiveIdx(index)}
                    className={cn(PLAN_SEG_BTN, index === activeIdx ? PLAN_SEG_ON : PLAN_SEG_OFF)}
                  >
                    {dayTabLabel(date)}
                  </button>
                ))}
              </div>
            ) : null}

            {!isGuest && people.length > 1 ? (
              <div>
                <p id="scenario-who" className="mp-font-ui m-0 mb-2 text-[15px] font-semibold text-[var(--mp-tx)]">С кем идём?</p>
                <div role="group" aria-labelledby="scenario-who" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
                  <button type="button" aria-pressed={selectedIds.length === 0} onClick={() => togglePerson(null)} className={cn(PLAN_CHIP, "shrink-0", selectedIds.length === 0 ? PLAN_CHIP_ON : PLAN_CHIP_OFF)}>
                    Все
                  </button>
                  {people.map((person) => (
                    <button key={person.id} type="button" aria-pressed={selectedIds.includes(person.id)} onClick={() => togglePerson(person.id)} className={cn(PLAN_CHIP, "shrink-0", selectedIds.includes(person.id) ? PLAN_CHIP_ON : PLAN_CHIP_OFF)}>
                      {person.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div role="group" aria-label="Как добираемся" className={cn(PLAN_SEG, "mt-3")}>
              {([["car", "На машине"], ["walk", "Пешком"]] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={cn(PLAN_SEG_BTN, mode === value ? PLAN_SEG_ON : PLAN_SEG_OFF)}>
                  {label}
                </button>
              ))}
            </div>

            {state?.error ? <DraftError kind={state.error} onRetry={() => activeDate && api.retry(activeDate)} authHref={authHref} /> : null}

            {!current && loading ? <DraftSkeleton /> : null}

            {showEmpty ? (
              <EmptyResult
                walking={walking}
                onSwitchToCar={() => setMode("car")}
                onChangeParams={isGuest ? () => setPhase("params") : onBack}
                changeLabel={isGuest ? "Изменить параметры" : "Назад в план"}
              />
            ) : null}

            {current ? (
              <div aria-busy={loading} className={cn("transition-opacity", loading && "opacity-60")}>
                {items.length > 0 ? (
                  <>
                    <p className="mp-font-ui m-0 mt-4 text-[17px] leading-[1.45] text-[var(--mp-tx)]">
                      {summaryLine(items)}
                      {hasPlanItems ? <span className="block text-[14px] text-[var(--mp-tx2)]">Подобрали к тому, что уже в плане</span> : null}
                    </p>
                    {seed && api.kept.length > 0 ? (
                      <p className="mp-font-ui m-0 mt-2 rounded-2xl bg-[var(--mp-card)] p-3 text-[13.5px] leading-[1.4] text-[var(--mp-tx2)]">
                        {api.kept.length === 1 ? "Одно сохранённое место" : `${api.kept.length} сохранённых мест`} в этом дне уже нельзя пересобрать (событие началось или место закрылось). Они останутся в плане как есть.
                      </p>
                    ) : null}
                    {showFewNearby ? <FewNearbyBanner onSwitchToCar={() => setMode("car")} /> : null}
                    <ScenarioTimeline
                      items={items}
                      ownEntries={ownEntries}
                      busy={loading}
                      onOpen={(item) => setViews([{ kind: "preview", item }])}
                      onRemove={(item) => activeDate && api.remove(activeDate, item.activityId)}
                      onReplace={(item) => void openReplace(item)}
                    />
                  </>
                ) : null}
                {exhausted ? <AllShown onRestart={() => activeDate && api.restart(activeDate)} /> : null}
                {items.length < MAX_TARGET_COUNT ? (
                  <button type="button" disabled={loading} onClick={() => activeDate && api.addMore(activeDate)} className={cn(QUIET_BTN, "mt-4 w-full border-dashed")}>
                    <Plus className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                    Добавить место
                  </button>
                ) : null}
                {/* Also when the day was emptied by hand: the previous draft must stay one tap away. */}
                <div className="mb-10 mt-4 grid grid-cols-2 gap-2">
                  <button type="button" disabled={loading || exhausted} onClick={() => activeDate && api.another(activeDate)} className={QUIET_BTN}>
                    <RefreshCw className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                    Другой вариант
                  </button>
                  <button type="button" disabled={loading || !state || !canGoBack(state.history)} onClick={() => activeDate && api.goBack(activeDate)} className={QUIET_BTN}>
                    <Undo2 className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                    Вернуть прошлый
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 bg-[linear-gradient(to_top,var(--mp-bg)_70%,transparent)] px-5 pb-6 pt-8 md:px-8">
        {phase === "params" ? (
          <button type="button" disabled={!paramsReady} onClick={submitParams} className={PRIMARY_BTN}>
            Собрать день
          </button>
        ) : (
          <>
            {isGuest ? (
              <>
                <button type="button" disabled={!canGuestSave} aria-describedby="scenario-save-hint" onClick={saveAsGuest} className={PRIMARY_BTN}>
                  {saveLabel(dates.length)}
                </button>
                <p id="scenario-save-hint" className="mp-font-ui m-0 mt-2 text-center text-[13px] text-[var(--mp-tx2)]">Нужен вход: после него день сохранится в план сам</p>
              </>
            ) : (
              <>
                <button type="button" disabled={!canSave} aria-busy={saving} aria-describedby={saveError ? "scenario-save-hint" : undefined} onClick={() => void saveDay()} className={PRIMARY_BTN}>
                  {saving ? "Сохраняем…" : seed ? "Сохранить изменения" : saveLabel(dates.length)}
                </button>
                {saveError ? (
                  <p id="scenario-save-hint" role="alert" className="mp-font-ui m-0 mt-2 text-center text-[13px] text-[var(--mp-ac-dark)]">{saveError}</p>
                ) : null}
              </>
            )}
          </>
        )}
      </div>

      </div>

      {views.map((view, index) => {
        const active = index === views.length - 1;
        const previous = views[index - 1];
        if (view.kind === "replace") {
          return (
            <ScenarioStackLayer key={`replace-${index}`} active={active} onBack={popView} label="Чем заменить?">
              <ScenarioReplaceScreen
                target={replacing}
                options={options}
                loading={optionsLoading}
                onBack={popView}
                onOpen={(option) => setViews((prev) => [...prev, { kind: "pick", option }])}
                onPick={pickOption}
              />
            </ScenarioStackLayer>
          );
        }
        if (view.kind === "pick") {
          return (
            <ScenarioStackLayer key={`pick-${index}`} active={active} onBack={popView} label={view.option.fresh.card.title}>
              <ScenarioItemPreview item={view.option.fresh} city={city} back="Замена" onBack={popView} onPick={() => pickOption(view.option)} />
            </ScenarioStackLayer>
          );
        }
        return (
          <ScenarioStackLayer key={`preview-${index}`} active={active} onBack={popView} label={view.item.card.title}>
            <ScenarioItemPreview
              item={view.item}
              city={city}
              back={previous ? "Назад" : "День"}
              onBack={popView}
              busy={loading}
              onReplace={() => void openReplace(view.item)}
              onRemove={() => {
                if (activeDate) api.remove(activeDate, view.item.activityId);
                closeStack();
              }}
            />
          </ScenarioStackLayer>
        );
      })}
    </div>
  );
}
