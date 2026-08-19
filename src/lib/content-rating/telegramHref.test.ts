import assert from "node:assert/strict";
import { getPublicTelegramHref } from "../site/publicSocialLinks";

assert.equal(getPublicTelegramHref(), "https://t.me/mamagoby");

console.log("✅ publicSocialLinks telegram href");
