import assert from "node:assert/strict";
import test from "node:test";
import { compareWithBaseline, findViolations, isVisibleEnglish } from "./check-admin-ru.mjs";

test("visible English is detected", () => {
  assert.equal(isVisibleEnglish("Top entities"), true);
  assert.equal(isVisibleEnglish("Overview"), true);
  assert.equal(isVisibleEnglish("Not enough volume"), true);
});

test("Russian, brands, codes, paths and code fragments are not violations", () => {
  assert.equal(isVisibleEnglish("Обзор"), false);
  assert.equal(isVisibleEnglish("Telegram"), false);
  assert.equal(isVisibleEnglish("Google Search Console"), false);
  assert.equal(isVisibleEnglish("robots.txt"), false);
  assert.equal(isVisibleEnglish("/admin/analytics"), false);
  assert.equal(isVisibleEnglish("PENDING_REVIEW"), false);
  assert.equal(isVisibleEnglish("12 345"), false);
  assert.equal(isVisibleEnglish("setPicking(false)"), false);
  assert.equal(isVisibleEnglish("API"), false);
});

test("JSX text, attributes and object fields are scanned", () => {
  const src = `
    export function X() {
      const [a, setA] = useState<string | null>(null);
      return (
        <div title="Global funnel">
          <h2>Top views</h2>
          <p>Обзор</p>
          <span>{count}</span>
        </div>
      );
    }
    const items = [{ label: "Weights", href: "/x" }, { label: "Веса", href: "/y" }];
  `;
  const kinds = findViolations(src, "X.tsx").map((v) => `${v.kind}:${v.text}`);
  assert.deepEqual(kinds.sort(), ["attr:Global funnel", "field:Weights", "jsx-text:Top views"].sort());
});

test("English locales and locale-less toLocale*String are flagged", () => {
  const src = `d.toLocaleDateString("en-CA"); d.toLocaleString(); d.toLocaleString("ru-RU", { timeZone: "Europe/Minsk" });`;
  const v = findViolations(src, "a.ts");
  assert.equal(v.length, 2);
  assert.ok(v.every((x) => x.kind === "locale"));
});

test("comments are ignored", () => {
  assert.deepEqual(findViolations(`// label: "Hello world"\n/* title="Some text" */\nconst a = 1;`, "a.tsx"), []);
});

test("baseline only allows the count to shrink", () => {
  const { grew, shrunk } = compareWithBaseline({ "a.tsx": 3, "b.tsx": 1, "c.tsx": 1 }, { "a.tsx": 3, "b.tsx": 2 });
  assert.deepEqual(grew.map((g) => g.file), ["c.tsx"]);
  assert.deepEqual(shrunk.map((g) => g.file), ["b.tsx"]);
});
