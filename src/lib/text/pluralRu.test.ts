import assert from "node:assert/strict";
import { pluralRu } from "./pluralRu";

const requests = (n: number) => `${n} ${pluralRu(n, "заявку", "заявки", "заявок")}`;

assert.equal(requests(1), "1 заявку");
assert.equal(requests(2), "2 заявки");
assert.equal(requests(5), "5 заявок");
assert.equal(requests(11), "11 заявок");
assert.equal(requests(21), "21 заявку");
assert.equal(requests(22), "22 заявки");
assert.equal(requests(0), "0 заявок");
assert.equal(requests(12), "12 заявок");
assert.equal(requests(14), "14 заявок");
assert.equal(requests(101), "101 заявку");
assert.equal(requests(111), "111 заявок");
