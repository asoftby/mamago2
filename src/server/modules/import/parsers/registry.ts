/**
 * Parser Registry
 * Маппинг parserKey → ImportParser.
 */

import type { ImportParser } from "./base.parser";
import { mockPlaceParser } from "./mock-place.parser";
import { mockEventParser } from "./mock-event.parser";
import { familyByPlaceParser } from "./family-by-place.parser";
import { familyByDirectoryPlaceParser } from "./family-by-directory-place.parser";
import { familyByPlaycenterPlaceParser } from "./family-by-playcenter-place.parser";
import { familyByAfishaEventParser } from "./family-by-afisha-event.parser";

const registry = new Map<string, ImportParser>([
  // Production parsers — PLACE
  [familyByPlaceParser.parserKey, familyByPlaceParser],
  [familyByDirectoryPlaceParser.parserKey, familyByDirectoryPlaceParser],
  [familyByPlaycenterPlaceParser.parserKey, familyByPlaycenterPlaceParser],
  // Production parsers — EVENT
  [familyByAfishaEventParser.parserKey, familyByAfishaEventParser],
  // Dev-only mock parsers
  [mockPlaceParser.parserKey, mockPlaceParser],
  [mockEventParser.parserKey, mockEventParser],
]);

export function getParser(parserKey: string): ImportParser | null {
  return registry.get(parserKey) ?? null;
}

export function listParserKeys(): string[] {
  return Array.from(registry.keys());
}
