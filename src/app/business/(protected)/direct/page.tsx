import { redirect } from "next/navigation";

/**
 * Technical compatibility only (Phase 3.2): "Мои сообщения" is now one
 * unified section for every role — see /me/direct. A business owner/member
 * sees their business's conversations merged into that same list, so this
 * route no longer renders its own inbox; it just forwards old links/bookmarks.
 */
export default function BusinessDirectRedirectPage() {
  redirect("/me/direct");
}
