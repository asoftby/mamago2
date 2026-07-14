import { htmlToPlainText } from "./buildRouteCreateDraft";

export interface RouteNoteHtmlFixRouteInput {
  id: string;
  title: string;
  stops: readonly { id: string; order: number; note: string }[];
}

export interface RouteNoteHtmlFixCandidate {
  routeId: string;
  routeTitle: string;
  stopId: string;
  order: number;
  before: string;
  after: string;
}

/**
 * Pure diff: which already-imported `RouteStop.note` values still contain
 * raw WP HTML (pre-`810d3254`, before `buildRouteCreateDraft` started
 * running `htmlToPlainText` on import) and what they'd become if re-run
 * through the same function today. A stop whose note is already plain text
 * produces no candidate — `htmlToPlainText` is idempotent on plain text
 * (see buildRouteCreateDraft.test.ts), so a second run of this script
 * after `--apply` must find zero candidates.
 */
export function planRouteNoteHtmlFixes(
  routes: readonly RouteNoteHtmlFixRouteInput[],
): RouteNoteHtmlFixCandidate[] {
  const candidates: RouteNoteHtmlFixCandidate[] = [];
  for (const route of routes) {
    for (const stop of route.stops) {
      const after = htmlToPlainText(stop.note);
      if (after !== stop.note) {
        candidates.push({
          routeId: route.id,
          routeTitle: route.title,
          stopId: stop.id,
          order: stop.order,
          before: stop.note,
          after,
        });
      }
    }
  }
  return candidates;
}
