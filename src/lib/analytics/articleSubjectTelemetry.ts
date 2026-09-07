export const ARTICLE_SUBJECT_BLOCK_VIEW_EVENT = "article_subject_block_view" as const;
export const ARTICLE_SUBJECT_ACTION_EVENT = "article_subject_action" as const;

export const ARTICLE_SUBJECT_TELEMETRY_EVENTS = [
  ARTICLE_SUBJECT_BLOCK_VIEW_EVENT,
  ARTICLE_SUBJECT_ACTION_EVENT,
] as const;

export type ArticleSubjectTelemetryEvent = (typeof ARTICLE_SUBJECT_TELEMETRY_EVENTS)[number];

export function isArticleSubjectTelemetryEvent(value: unknown): value is ArticleSubjectTelemetryEvent {
  return ARTICLE_SUBJECT_TELEMETRY_EVENTS.includes(value as ArticleSubjectTelemetryEvent);
}

export function isArticleSubjectTelemetryMeta(meta: unknown): boolean {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return false;
  return isArticleSubjectTelemetryEvent((meta as Record<string, unknown>).articleEvent);
}
