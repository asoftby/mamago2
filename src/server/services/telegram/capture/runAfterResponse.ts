import { after } from "next/server";

type Schedule = (task: () => Promise<void>) => void;

/**
 * Runs `fn` after the HTTP response has been sent, using Next's `after()`.
 * If `after()` is unavailable for the current call (outside a request scope),
 * falls back to a guarded fire-and-forget. Errors never propagate and are
 * logged as a code only.
 */
export function runAfterResponse(fn: () => Promise<void>, schedule: Schedule = after): void {
  const guarded = async () => {
    try {
      await fn();
    } catch {
      console.error("[telegram:capture] code=AFTER_RESPONSE_TASK_FAILED");
    }
  };

  try {
    schedule(guarded);
  } catch {
    void guarded();
  }
}
