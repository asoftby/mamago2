import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const list = source.slice(source.indexOf('<div className="hidden md:block'), source.indexOf("export default async function"));

assert.doesNotMatch(list, />Возраст</);
assert.doesNotMatch(list, /label="Возраст"/);
assert.match(list, /min-w-\[760px\]/);
assert.match(list, /label="Бизнес"/);
assert.match(list, /label="Создано"/);

console.log("eventsList.contract.test.ts: OK");
