"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import { AUTH_STATE_CHANGED_EVENT } from "@/lib/auth/client";
import { FAMILY_PERSONAS_CHANGED_EVENT } from "@/lib/family/familyPersonaEvents";

/** Hide the old account synchronously; the server alone chooses the next audience. */
export function HomeEventsBoundary({ actorId, children }: { actorId: string | null; children: React.ReactNode }) {
  const auth = useAuthMe();
  const router = useRouter();
  const { refetch, isLoading } = auth;
  const currentActor = auth.user?.id ?? null;
  useEffect(() => {
    if (!isLoading && currentActor !== actorId) { void refetch(); router.refresh(); }
  }, [currentActor, actorId, isLoading, refetch, router]);
  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, refresh);
    window.addEventListener(FAMILY_PERSONAS_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener(AUTH_STATE_CHANGED_EVENT, refresh); window.removeEventListener(FAMILY_PERSONAS_CHANGED_EVENT, refresh); window.removeEventListener("focus", refresh); };
  }, [router]);
  if (auth.isLoading || currentActor !== actorId) return <div className="min-h-[500px] animate-pulse rounded-2xl bg-muted/40" role="status">Обновляем мероприятия…</div>;
  return children;
}
