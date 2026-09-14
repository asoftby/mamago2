/**
 * ABWS sale-frame widget URLs (saleframe.24afisha.by).
 *
 * `distributor_company_id` is how 24afisha attributes a sale to mamaGo for
 * the partner commission — confirmed by the ABWS developer, not a guess.
 * `session.urlSaleframe` (sid, per-session) already carries it from the API
 * on every one of 6607 live sessions checked; `performance.urlSaleframe`
 * (pid, whole-event) never does (checked the same way, 769/769) — a pid
 * link is useless for commission unless we add it ourselves.
 *
 * Shared with the parser (`abws-performances-event.parser.ts`), which sends
 * the same id as `distributor_company_id` on the catalog-sync request
 * itself — one constant, so the two call sites can never drift apart.
 */
export const ABWS_DISTRIBUTOR_COMPANY_ID = 550;

export type AbwsSaleframeLinkKind = "pid" | "sid";

/**
 * Build the final URL for the ABWS sale-frame widget (`afp.js` intercepts
 * clicks on saleframe.24afisha.by links and opens them in a frame instead
 * of navigating away — falls back to a normal navigation if the widget
 * script hasn't loaded yet).
 *
 * Deliberately a render-time call, not something baked into stored data:
 * `distributor_company_id` is a single account-level constant, not
 * per-record — computing the final URL on every render means a future
 * change applies to every card, old and new, with no database backfill.
 * The raw `rawUrl` (`ActivitySession.buyUrl` / `scheduleJson.ticketLink`)
 * stays exactly what the ABWS API returned.
 *
 * - `kind: "sid"` (per-session link): `distributor_company_id` is already
 *   present in the source URL — never appended twice.
 * - `kind: "pid"` (whole-event link): `distributor_company_id` is never
 *   present in the source URL — added here, since without it a sale
 *   through the general "Купить билет" button won't be attributed at all.
 * - `lang=ru` is always added for both kinds.
 * - Idempotent: an existing `lang`/`distributor_company_id` param on the
 *   input is left as-is, never duplicated.
 */
export function buildAbwsSaleframeUrl(kind: AbwsSaleframeLinkKind, rawUrl: string): string {
  const url = new URL(rawUrl);

  if (!url.searchParams.has("lang")) {
    url.searchParams.set("lang", "ru");
  }

  if (kind === "pid" && !url.searchParams.has("distributor_company_id")) {
    url.searchParams.set("distributor_company_id", String(ABWS_DISTRIBUTOR_COMPANY_ID));
  }

  return url.toString();
}
