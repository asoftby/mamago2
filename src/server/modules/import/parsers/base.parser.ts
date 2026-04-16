/**
 * Import Parser — base contract
 * Phase 2A: foundation для PLACE parsers.
 * Phase EVENT: добавлен EventImportParser.
 */

import type { ImportSource } from "@prisma/client";
import type { ParsedRawRecord, ParserResult } from "../types";

/**
 * Базовый интерфейс парсера.
 */
export interface ImportParser {
  readonly parserKey: string;
  parse(source: ImportSource): Promise<ParserResult>;
}

/**
 * Парсер для PLACE.
 */
export interface PlaceImportParser extends ImportParser {
  readonly entityType: "PLACE";
}

/**
 * Парсер для EVENT.
 */
export interface EventImportParser extends ImportParser {
  readonly entityType: "EVENT";
}

export function emptyParserResult(parserKey: string): ParserResult {
  return { records: [], totalFound: 0, parserKey };
}

export function errorParserResult(parserKey: string, error: string): ParserResult {
  return { records: [], totalFound: 0, parserKey, error };
}

export function makeRawRecord(
  sourceUrl: string,
  rawPayload: Record<string, unknown>,
  opts?: Partial<Omit<ParsedRawRecord, "sourceUrl" | "rawPayload">>,
): ParsedRawRecord {
  return { sourceUrl, rawPayload, ...opts };
}
