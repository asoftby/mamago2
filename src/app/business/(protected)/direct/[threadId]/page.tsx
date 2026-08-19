import { redirect } from "next/navigation";

/**
 * Technical compatibility only (Phase 3.2) — see /business/direct/page.tsx.
 * Old notification links (notifyDirectMessage ctaAction generated before
 * this phase) still point at /business/direct/{threadId}; this route just
 * forwards them to the unified /me/direct/{threadId} screen, which renders
 * the correct side of the conversation based on who's signed in.
 */
export default async function BusinessDirectThreadRedirectPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  redirect(`/me/direct/${threadId}`);
}
