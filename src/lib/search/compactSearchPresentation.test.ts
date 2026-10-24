import assert from "node:assert/strict";
import { formatSearchAddress, formatSearchAgeFromTags } from "./compactSearchPresentation";

assert.equal(formatSearchAddress("г. Минск, ул. Московская, 18а, Минск", "Минск"), "г. Минск, ул. Московская, 18а");
assert.equal(formatSearchAddress("г. Минск, ул. Петра Мстиславца 11, Минск, Беларусь", "Минск"), "г. Минск, ул. Петра Мстиславца 11");
assert.equal(formatSearchAddress("ул. Неманская, 45", "Минск"), "г. Минск, ул. Неманская, 45");
assert.equal(formatSearchAddress("г. Минск, проспект Независимости, 3/2, Минск, Беларусь", "Минск"), "г. Минск, проспект Независимости, 3/2");
assert.equal(formatSearchAddress("пр. Независимости, 3/2, Беларусь", "Минск"), "г. Минск, пр. Независимости, 3/2");
assert.equal(formatSearchAgeFromTags(["0-1", "1-3", "3-5", "5-7"]), "0+");
assert.equal(formatSearchAgeFromTags(["9-12", "6-9"]), "6+");
assert.equal(formatSearchAgeFromTags([]), null);
