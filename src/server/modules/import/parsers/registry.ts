/**
 * Parser Registry
 * Маппинг parserKey → ImportParser.
 */

import type { ImportParser } from "./base.parser";
import { errorParserResult } from "./base.parser";
import { familyByPlaceParser } from "./family-by-place.parser";
import { familyByDirectoryPlaceParser } from "./family-by-directory-place.parser";
import { familyByPlaycenterPlaceParser } from "./family-by-playcenter-place.parser";
import { familyByAfishaEventParser } from "./family-by-afisha-event.parser";
import { fetchHtml } from "./fetchHtml";
import {
  prepareSourceAccessContext,
  withSourceAccessContext,
} from "./sourceAccessPolicy";

function withManagedSourceAccess(parser: ImportParser): ImportParser {
  return {
    ...parser,
    async parse(source) {
      try {
        const accessContext = await prepareSourceAccessContext(
          source,
          async (robotsUrl) => {
            const response = await fetchHtml(robotsUrl, {
              encoding: "utf-8",
              timeoutMs: 8_000,
              retries: 1,
              headers: {
                Accept: "text/plain,*/*;q=0.1",
              },
            });

            return {
              text: response.html,
              status: response.status,
            };
          },
        );

        if (accessContext) {
          console.info("[import.sourceAccess] source policy ready", {
            source: source.slug,
            parserKey: parser.parserKey,
            host: accessContext.sourceHost,
            robotsRules: accessContext.robotsPolicy.rules.length,
            minRequestIntervalMs: accessContext.minRequestIntervalMs,
            cacheTtlMs: accessContext.cacheTtlMs,
          });
        }

        return await withSourceAccessContext(accessContext, () => parser.parse(source));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn("[import.sourceAccess] import blocked before parser execution", {
          source: source.slug,
          parserKey: parser.parserKey,
          error: message,
        });
        return errorParserResult(parser.parserKey, `Source access policy: ${message}`);
      }
    },
  };
}

const registry = new Map<string, ImportParser>([
  // Production parsers — PLACE
  [familyByPlaceParser.parserKey, withManagedSourceAccess(familyByPlaceParser)],
  [familyByDirectoryPlaceParser.parserKey, withManagedSourceAccess(familyByDirectoryPlaceParser)],
  [familyByPlaycenterPlaceParser.parserKey, withManagedSourceAccess(familyByPlaycenterPlaceParser)],
  // Production parsers — EVENT
  [familyByAfishaEventParser.parserKey, withManagedSourceAccess(familyByAfishaEventParser)],
]);

export function getParser(parserKey: string): ImportParser | null {
  return registry.get(parserKey) ?? null;
}

export function listParserKeys(): string[] {
  return Array.from(registry.keys());
}
