#!/usr/bin/env node
/**
 * Read-only inventory of UI patterns. Findings are migration candidates, not
 * automatic violations. No generated files or application code are modified.
 *
 * Usage:
 *   node scripts/design-system-audit.mjs
 *   node scripts/design-system-audit.mjs --json
 *   node scripts/design-system-audit.mjs --out /tmp/ui-audit.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RULES = [
  { id: "native-button", description: "Native <button> (review for shared Button)", pattern: /<button\b/g },
  { id: "native-input", description: "Native <input> (review for shared Input)", pattern: /<input\b/g },
  { id: "native-select", description: "Native <select> (review for shared Select)", pattern: /<select\b/g },
  { id: "native-textarea", description: "Native <textarea> (review for shared Textarea)", pattern: /<textarea\b/g },
  { id: "hex-color", description: "Literal hex color (review against tokens)", pattern: /#[\da-fA-F]{3,8}\b/g },
  { id: "arbitrary-radius", description: "Arbitrary Tailwind radius", pattern: /\brounded-\[[^\]]+\]/g },
  { id: "arbitrary-size", description: "Arbitrary Tailwind control height", pattern: /\b(?:min-h|h)-\[(?:\d+(?:px|rem)|[^\]]*dvh)\]/g },
  { id: "button-component", description: "Shared Button", pattern: /<Button\b/g },
  { id: "primary-button-component", description: "Legacy PrimaryButton wrapper", pattern: /<PrimaryButton\b/g },
  { id: "chip-component", description: "Chip", pattern: /<Chip\b/g },
  { id: "chips-row-component", description: "ChipsRow", pattern: /<ChipsRow\b/g },
  { id: "badge-component", description: "Badge", pattern: /<Badge\b/g },
];

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "coverage", "__snapshots__"]);
function sourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) result.push(...sourceFiles(full));
    else if (entry.isFile() && /\.(tsx|jsx)$/.test(entry.name) && !/\.(test|spec)\.[tj]sx$/.test(entry.name)) result.push(full);
  }
  return result.sort();
}

export function auditSourceDirectory(root) {
  const findings = [];
  const files = sourceFiles(path.join(root, "src"));
  for (const file of files) {
    const relativePath = path.relative(root, file).split(path.sep).join("/");
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const source = lines[i];
      for (const rule of RULES) {
        const matches = [...source.matchAll(rule.pattern)];
        if (matches.length) findings.push({
          rule: rule.id,
          file: relativePath,
          line: i + 1,
          count: matches.length,
          excerpt: source.trim().slice(0, 150),
        });
      }
    }
  }
  const counts = Object.fromEntries(RULES.map((rule) => [
    rule.id,
    findings.filter((finding) => finding.rule === rule.id).reduce((sum, finding) => sum + finding.count, 0),
  ]));
  return {
    scannedFiles: files.length,
    counts,
    rules: RULES.map(({ id, description }) => ({ id, description })),
    findings,
  };
}

export function toMarkdown(report, maxExamples = 12) {
  const lines = [
    "# mamaGo UI design-system audit",
    "",
    "Read-only heuristic inventory. Counts represent source matches, **not** confirmed bugs.",
    "Review each finding manually before replacing any markup or token.",
    "",
    "Scanned TSX/JSX files: " + report.scannedFiles,
    "",
    "| Pattern | Occurrences |",
    "|---|---:|",
    ...report.rules.map((rule) => "| " + rule.description + " (" + rule.id + ") | " + report.counts[rule.id] + " |"),
    "",
    "## Examples by pattern",
  ];
  for (const rule of report.rules) {
    const relevant = report.findings.filter((item) => item.rule === rule.id);
    if (!relevant.length) continue;
    lines.push("", "### " + rule.description);
    for (const finding of relevant.slice(0, maxExamples)) {
      lines.push("- " + finding.file + ":" + finding.line + " — " + finding.excerpt.replace(/\|/g, "\\|"));
    }
    if (relevant.length > maxExamples) lines.push("- ... " + (relevant.length - maxExamples) + " more matching lines");
  }
  lines.push("", "## Interpretation", "", "- Native controls may be correct for specialized accessibility or browser integrations.", "- Color literals in images, SVGs and legacy media styling may be intentional.", "- Decide canonical tokens and component APIs before introducing an enforcement gate.", "");
  return lines.join("\n");
}

function main(argv) {
  const rootFlag = argv.indexOf("--root");
  const outFlag = argv.indexOf("--out");
  const root = rootFlag >= 0 && argv[rootFlag + 1] ? path.resolve(argv[rootFlag + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const report = auditSourceDirectory(root);
  const result = argv.includes("--json") ? JSON.stringify(report, null, 2) + "\n" : toMarkdown(report);
  if (outFlag >= 0) {
    if (!argv[outFlag + 1]) throw new Error("--out requires a file path");
    fs.writeFileSync(path.resolve(argv[outFlag + 1]), result, "utf8");
  } else process.stdout.write(result);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
