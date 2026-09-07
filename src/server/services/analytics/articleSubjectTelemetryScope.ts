import { Prisma } from "@prisma/client";
import {
  ARTICLE_SUBJECT_ACTION_EVENT,
  ARTICLE_SUBJECT_BLOCK_VIEW_EVENT,
} from "@/lib/analytics/articleSubjectTelemetry";

/**
 * Article-subject interactions share the generic UserEvent transport but are a
 * separate reporting scope. Canonical product funnels/views/CTA must exclude
 * them; dedicated article-subject reports query them explicitly by meta fields.
 */
export const ARTICLE_SUBJECT_TELEMETRY_EXCLUSION_WHERE: Prisma.UserEventWhereInput = {
  NOT: [
    {
      meta: {
        path: ["articleEvent"],
        equals: ARTICLE_SUBJECT_BLOCK_VIEW_EVENT,
      },
    },
    {
      meta: {
        path: ["articleEvent"],
        equals: ARTICLE_SUBJECT_ACTION_EVENT,
      },
    },
  ],
};

export function withCanonicalUserEventScope(
  where: Prisma.UserEventWhereInput,
): Prisma.UserEventWhereInput {
  return {
    AND: [where, ARTICLE_SUBJECT_TELEMETRY_EXCLUSION_WHERE],
  };
}

export const ARTICLE_SUBJECT_TELEMETRY_EXCLUSION_SQL = Prisma.sql`
  COALESCE(e."meta"->>'articleEvent', '') NOT IN (
    ${ARTICLE_SUBJECT_BLOCK_VIEW_EVENT},
    ${ARTICLE_SUBJECT_ACTION_EVENT}
  )
`;
