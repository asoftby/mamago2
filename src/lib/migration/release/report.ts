import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

import type { PhoenixPhaseReport } from "./types";
import type { PhoenixReportStore } from "./coordinator";

const SECRET_KEYS = /(password|token|secret|database_?url|credential)/i;

export function sanitizeReport(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeReport);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SECRET_KEYS.test(key))
      .map(([key, child]) => [key, sanitizeReport(child)]),
  );
}

export class JsonLinesPhoenixReportStore implements PhoenixReportStore {
  constructor(private readonly path: string) {}

  async append(report: PhoenixPhaseReport): Promise<void> {
    mkdirSync(dirname(this.path), { recursive: true });
    appendFileSync(this.path, `${JSON.stringify(sanitizeReport(report))}\n`, { encoding: "utf8", mode: 0o600 });
  }

  async readCompletedPrefix(): Promise<readonly PhoenixPhaseReport[]> {
    try {
      return readFileSync(this.path, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as PhoenixPhaseReport);
    } catch {
      return [];
    }
  }
}
