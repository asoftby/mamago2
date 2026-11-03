"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import { AUTH_STATE_CHANGED_EVENT } from "@/lib/auth/client";
import { FAMILY_PERSONAS_CHANGED_EVENT } from "@/lib/family/familyPersonaEvents";

const HOME_AUTH_WAIT_MS = 8_000;

/**
 * Hide the previous actor's recommendations synchronously. Auth and the
 * server-rendered audience may briefly disagree after login/logout, but a
 * failed refresh must never leave a permanent 500px skeleton on the page.
 */
export function HomeEventsBoundary({
  actorId,
  citySlug,
  children,
}: {
  actorId: string | null;
  citySlug: string;
  children: React.ReactNode;
}) {
  const auth = useAuthMe();
  const router = useRouter();
  const { refetch, isLoading } = auth;
  const currentActor = auth.user?.id ?? null;
  const waiting = isLoading || currentActor !== actorId;
  const pendingKey = [actorId ?? "guest", isLoading ? "auth-loading" : currentActor ?? "guest"].join(":");
  const [expiredKey, setExpiredKey] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const refreshAttemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!waiting) return;
    const timeout = window.setTimeout(() => setExpiredKey(pendingKey), HOME_AUTH_WAIT_MS);
    return () => window.clearTimeout(timeout);
  }, [waiting, pendingKey, retryCount]);

  useEffect(() => {
    if (isLoading || currentActor === actorId) {
      if (!isLoading) refreshAttemptedRef.current = null;
      return;
    }
    const mismatch = [actorId ?? "guest", currentActor ?? "guest"].join(":");
    if (refreshAttemptedRef.current === mismatch) return;
    refreshAttemptedRef.current = mismatch;
    void refetch();
    router.refresh();
  }, [currentActor, actorId, isLoading, refetch, router]);

  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, refresh);
    window.addEventListener(FAMILY_PERSONAS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, refresh);
      window.removeEventListener(FAMILY_PERSONAS_CHANGED_EVENT, refresh);
    };
  }, [router]);

  if (!waiting) return children;

  const retry = () => {
    setExpiredKey(null);
    setRetryCount((previous) => previous + 1);
    refreshAttemptedRef.current = null;
    void refetch();
    router.refresh();
  };

  return (
    <section className="min-h-40 rounded-2xl bg-muted/30 p-5" aria-live="polite">
      {expiredKey !== pendingKey ? (
        <p role="status" className="text-sm text-muted-foreground">
          Подбираем мероприятия для вашей семьи…
        </p>
      ) : (
        <div role="alert" className="space-y-3">
          <p className="text-sm text-foreground">Не удалось обновить мероприятия.</p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <button type="button" onClick={retry} className="min-h-11 font-medium underline">
              Повторить
            </button>
            <Link className="inline-flex min-h-11 items-center underline" href={"/" + citySlug + "/events"}>
              Смотреть все события
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
