"use client";

import { useState } from "react";
import Link from "next/link";
import { scenarioConflictAnchorId, type ScenarioClientItem, type ScenarioReplacementCandidate } from "@/features/my-plan/lib/scenarioDraft";
import type { ScenarioGap } from "@/features/my-plan/lib/scenarioTravel";
import { IcAlert, IcCheck, IcClose, IcMapPin, IcRoute, IcSwap } from "@/features/my-plan/components/scenarioIcons";

/**
 * Presentational Scenario pieces, kept in a file that never imports the
 * `.css` module directly — `styles` is threaded in as a plain
 * class-name-lookup prop instead. `ScenarioDraftEditor.tsx` (the real CSS
 * module consumer) supplies the genuine module; `ScenarioDraftEditor.test.tsx`
 * exercises these components with a plain stub, since the CSS Modules
 * import crashes under the project's `tsx <file>.test.ts` runner (no
 * bundler asset pipeline there) — the same reason `BookingEmptyStateActions`
 * takes its class names as props instead of importing `bookings.module.css`.
 */
export type ScenarioStyles = Record<string, string>;

const scenarioTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Minsk",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatScenarioTimeRange(item: Pick<ScenarioClientItem, "startsAt" | "endsAt">): string {
  if (!item.startsAt) return "Гибкое время";
  return scenarioTimeFormatter.format(new Date(item.startsAt));
}

export function formatDurationLabel(minutes: number | null): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes} м`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} м`;
}

export function ScenarioCard({
  item,
  styles,
  onRemove,
}: {
  item: ScenarioClientItem;
  styles: ScenarioStyles;
  onRemove?: () => void;
}) {
  const title = item.href ? (
    <Link href={item.href}>
      <h3>{item.title}</h3>
    </Link>
  ) : (
    <h3>{item.title}</h3>
  );

  return (
    <div className={styles.cardIn}>
      <span className={styles.im}>{item.coverImageUrl ? <img src={item.coverImageUrl} alt="" /> : null}</span>
      <div className={styles.cardBody}>
        {title}
        {item.addressLabel ? (
          <div className={styles.meta}>
            <span>
              <IcMapPin />
              {item.addressLabel}
            </span>
          </div>
        ) : null}
        {item.isBooked ? (
          <div className={styles.tags}>
            <span className={`${styles.tag} ${styles.tagAccent}`}>Забронировано</span>
          </div>
        ) : null}
      </div>
      {item.priceLabel ? <span className={styles.price}>{item.priceLabel}</span> : <span />}
      {onRemove ? (
        <button className={styles.kill} aria-label={`Удалить: ${item.title}`} onClick={onRemove}>
          <IcClose />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

export function ScenarioSwapCard({
  candidate,
  styles,
  onPick,
}: {
  candidate: ScenarioReplacementCandidate;
  styles: ScenarioStyles;
  onPick: () => void;
}) {
  const durationLabel = formatDurationLabel(candidate.durationMinutes);
  return (
    <button type="button" className={styles.sc} onClick={onPick}>
      <span className={styles.scIm}>{candidate.coverImageUrl ? <img src={candidate.coverImageUrl} alt="" /> : null}</span>
      <span className={styles.scBody}>
        <span className={styles.scTitle}>{candidate.title}</span>
        <span className={styles.scMeta}>
          {formatScenarioTimeRange(candidate)}
          {durationLabel ? ` · ${durationLabel}` : ""}
          {candidate.addressLabel ? ` · ${candidate.addressLabel}` : ""}
        </span>
        <span className={styles.scBottom}>
          <span className={styles.scPrice}>{candidate.priceLabel ?? "—"}</span>
          <span className={styles.put}>Выбрать</span>
        </span>
      </span>
    </button>
  );
}

export function ScenarioGapRow({ gap, styles }: { gap: ScenarioGap; styles: ScenarioStyles }) {
  if (gap.travelMinutes == null && gap.bufferMinutes == null) return null;
  return (
    <div className={`${styles.gap} ${gap.tight ? styles.gapTight : ""}`}>
      <span className={styles.gapNode} />
      <IcRoute />
      <span>
        {gap.travelMinutes != null ? (
          <>
            Дорога ≈<b>{gap.travelMinutes} мин</b>
          </>
        ) : null}
        {gap.travelMinutes != null && gap.bufferMinutes != null ? " · " : ""}
        {gap.bufferMinutes != null ? (
          gap.bufferMinutes >= 0 ? (
            <>
              запас <b>{formatDurationLabel(gap.bufferMinutes)}</b>
            </>
          ) : (
            <b>впритык</b>
          )
        ) : null}
      </span>
    </div>
  );
}

type ConflictClusterProps = {
  conflictKey: string;
  items: ScenarioClientItem[];
  styles: ScenarioStyles;
  onRemove: (planItemId: string) => void;
  onKeepBoth: (conflictKey: string) => void;
  replacementFor: string | null;
  loadingCandidates: boolean;
  candidatesFor: (planItemId: string) => ScenarioReplacementCandidate[];
  onRequestReplacement: (planItemId: string) => void;
  onPickReplacement: (planItemId: string, candidate: ScenarioReplacementCandidate) => void;
};

export function ScenarioConflictCluster({
  conflictKey,
  items,
  styles,
  onRemove,
  onKeepBoth,
  replacementFor,
  loadingCandidates,
  candidatesFor,
  onRequestReplacement,
  onPickReplacement,
}: ConflictClusterProps) {
  const [keptId, setKeptId] = useState<string | null>(null);
  const kept = items.find((item) => item.planItemId === keptId) ?? null;
  const dropped = kept ? items.find((item) => item.planItemId !== kept.planItemId) ?? null : null;
  const swapOpen = dropped != null && replacementFor === dropped.planItemId;
  const titles = items.map((item) => item.title).join(" и ");

  return (
    <div id={scenarioConflictAnchorId(conflictKey)} className={styles.clus} aria-label={`Пересечение: ${titles}`}>
      <div className={styles.clusHead}>
        <span className={styles.clusLabel}>
          <IcAlert /> Конфликт
        </span>
        <span className={styles.clusText}>
          {kept ? `«${kept.title}» остаётся — подберите время второму` : `Выберите, что оставить в ${formatScenarioTimeRange(items[0]!)}`}
        </span>
      </div>

      {items.map((item) => {
        const isKept = keptId === item.planItemId;
        const isDimmed = kept != null && !isKept;
        return (
          <div key={item.planItemId} className={`${styles.card} ${isDimmed ? styles.cardDim : ""}`}>
            <ScenarioCard item={item} styles={styles} />
            <div className={styles.keep}>
              <span className={styles.keepLabel}>{formatScenarioTimeRange(item)}</span>
              <button
                type="button"
                className={`${styles.sel} ${isKept ? styles.selOn : ""}`}
                aria-label={`Оставить: ${item.title}`}
                onClick={() => setKeptId(isKept ? null : item.planItemId)}
              >
                <IcCheck /> Оставить
              </button>
            </div>
          </div>
        );
      })}

      {dropped ? (
        <button
          type="button"
          className={styles.offer}
          disabled={loadingCandidates && replacementFor === dropped.planItemId}
          onClick={() => onRequestReplacement(dropped.planItemId)}
        >
          <IcSwap /> Предложить замену
        </button>
      ) : null}

      {swapOpen && dropped ? (
        <div className={styles.swap}>
          <div className={styles.swapHead}>
            <span className={styles.caps}>● Замена для «{dropped.title}»</span>
            <span className={styles.swapRule} />
          </div>
          {loadingCandidates ? (
            <p className={styles.clusText}>Загрузка…</p>
          ) : candidatesFor(dropped.planItemId).length === 0 ? (
            <p className={styles.clusText}>Нет подходящих замен рядом по времени</p>
          ) : (
            <div className={styles.srail}>
              {candidatesFor(dropped.planItemId)
                .slice(0, 6)
                .map((candidate) => (
                  <ScenarioSwapCard
                    key={`${candidate.activityId}:${candidate.activitySessionId ?? "flex"}`}
                    candidate={candidate}
                    styles={styles}
                    onPick={() => onPickReplacement(dropped.planItemId, candidate)}
                  />
                ))}
            </div>
          )}
        </div>
      ) : null}

      <div className={styles.keepBothRow}>
        {dropped ? (
          <>
            <button type="button" className={styles.keepBothBtn} aria-label={`Удалить: ${dropped.title}`} onClick={() => onRemove(dropped.planItemId)}>
              Удалить «{dropped.title}»
            </button>
            {" · "}
          </>
        ) : null}
        <button type="button" className={styles.keepBothBtn} aria-label={`Оставить оба: ${titles}`} onClick={() => onKeepBoth(conflictKey)}>
          Оставить оба, разберусь позже
        </button>
      </div>
    </div>
  );
}

export function ScenarioUndoStatus({
  label,
  targetTitle,
  styles,
  actionLabel = "Вернуть",
  onUndo,
}: {
  label: string;
  targetTitle: string;
  styles: ScenarioStyles;
  actionLabel?: "Вернуть" | "Отменить";
  onUndo: () => void;
}) {
  return (
    <p className={styles.removedRow}>
      {label} ·{" "}
      <button type="button" className={styles.undo} aria-label={`${actionLabel}: ${targetTitle}`} onClick={onUndo}>
        {actionLabel}
      </button>
    </p>
  );
}
