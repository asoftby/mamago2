import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const news = readFileSync(new URL("./BreakingNewsView.tsx", import.meta.url), "utf8");
// Avatar, author name and Save/Share buttons are vertically centered on one row.
const bar = readFileSync(new URL("../ArticleAuthorActionsBar.tsx", import.meta.url), "utf8");
assert.match(bar, /flex flex-nowrap items-center gap-2/);
assert.ok(news.includes('className="!border-t-0 !pt-[30px] !pb-[30px] md:!pt-[45px] md:!pb-[45px]"'));
// Avoid extra top/bottom margins around the requested 30px and 45px spacing.
assert.ok(news.includes('excerpt ? "mb-4" : "mb-0"'));
assert.ok(news.includes('<section style={{ padding: "0 0 12px" }}>'));
assert.match(news, /\{tags\.length > 0 \? \(/);
console.log("Breaking News author/actions spacing contracts: OK");
