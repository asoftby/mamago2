import assert from "node:assert/strict";
import { swapKeyboardLayout } from "./keyboardLayout";

assert.equal(swapKeyboardLayout("relf gjqnb"), "куда пойти");
assert.equal(swapKeyboardLayout("vbycr"), "минск");
assert.equal(swapKeyboardLayout("fybvfnjhs"), "аниматоры");
assert.equal(swapKeyboardLayout("Минск"), "Vbycr");
assert.equal(swapKeyboardLayout("ghbdtn"), "привет");
assert.equal(swapKeyboardLayout("Привет"), "Ghbdtn");
assert.equal(swapKeyboardLayout("mamaGo мама"), null);
assert.equal(swapKeyboardLayout("123"), null);
assert.equal(swapKeyboardLayout(""), null);
assert.equal(swapKeyboardLayout("Ёж"), "`;");
assert.equal(swapKeyboardLayout("{j,,b"), "Хобби");
assert.equal(swapKeyboardLayout(":ehyfk"), "Журнал");
console.log("RU/EN keyboard layout tests: OK");
