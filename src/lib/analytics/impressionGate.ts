/**
 * Показ (impression) = карточка видна ≥ `threshold` площади непрерывно ≥ `dwellMs`.
 * Чистая state-machine без DOM: таймеры подаются снаружи, поэтому логика тестируется.
 */
export const IMPRESSION_VISIBLE_RATIO = 0.5;
export const IMPRESSION_DWELL_MS = 1000;

export type ImpressionGate = {
  /** Новое значение intersectionRatio; ratio=0 при уходе из viewport. */
  update(ratio: number): void;
  /** Снять ожидающий таймер (unmount / скрытая вкладка). */
  cancel(): void;
  readonly fired: boolean;
};

export function createImpressionGate(options: {
  threshold?: number;
  dwellMs?: number;
  onImpression: () => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}): ImpressionGate {
  const threshold = options.threshold ?? IMPRESSION_VISIBLE_RATIO;
  const dwellMs = options.dwellMs ?? IMPRESSION_DWELL_MS;
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let handle: unknown = null;
  let fired = false;

  const cancel = () => {
    if (handle !== null) {
      clearTimer(handle);
      handle = null;
    }
  };

  return {
    update(ratio) {
      if (fired) return;
      if (ratio >= threshold) {
        if (handle !== null) return;
        handle = setTimer(() => {
          handle = null;
          if (fired) return;
          fired = true;
          options.onImpression();
        }, dwellMs);
      } else {
        cancel();
      }
    },
    cancel,
    get fired() {
      return fired;
    },
  };
}
