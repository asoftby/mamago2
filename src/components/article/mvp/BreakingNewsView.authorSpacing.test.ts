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
// Topic links now follow the story body rather than the author row.
assert.ok(news.includes("{tags.length > 0 && ("));
assert.ok(news.indexOf("<ArticleBody blocks={blocks} />") < news.indexOf("<PublicationTagLinks tags={tags}"));
assert.ok(news.indexOf("<PublicationTagLinks tags={tags}") < news.indexOf("<ContentEmojiRating"));
console.log("Breaking News author/actions spacing contracts: OK");
