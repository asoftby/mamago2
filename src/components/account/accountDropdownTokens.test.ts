import assert from "node:assert/strict";
import { isAccountRowActive } from "./accountDropdownTokens";

const ideas = { activeHref: "/me/ideas" };
const me = { activeHref: "/me", activeExact: true };

// Меню открыто с главной, из каталога, из плана — ничего не активно.
for (const path of ["/", "/minsk", "/minsk/events", "/me/plan", null]) {
  assert.equal(isAccountRowActive(path, ideas), false, `ideas @ ${path}`);
}
assert.equal(isAccountRowActive("/me/ideas", ideas), true);
assert.equal(isAccountRowActive("/me/ideas/collections/x", ideas), true);
assert.equal(isAccountRowActive("/me/ideas-archive", ideas), false);

// «Мои данные» (/me) активны только на самой /me, а не на всех /me/*.
assert.equal(isAccountRowActive("/me", me), true);
assert.equal(isAccountRowActive("/me/ideas", me), false);
assert.equal(isAccountRowActive("/me/plan", me), false);

// Пункт без activeHref (админка, контекстные) активным не бывает.
assert.equal(isAccountRowActive("/me", {}), false);
console.log("accountDropdownTokens: OK");
