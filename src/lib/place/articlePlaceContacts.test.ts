import assert from "node:assert/strict";
import { contactsFromArticlePlace } from "./articlePlaceContacts";

assert.equal(contactsFromArticlePlace({ website: "https://example.by" }).website, "https://example.by");
assert.equal(contactsFromArticlePlace({ website: "example.by" }).website, undefined);
assert.deepEqual(contactsFromArticlePlace({ instagramUrl: "@place" }).socials, []);
assert.equal(contactsFromArticlePlace({ mapUrl: "maps/place" }).mapUrl, undefined);

const mixed = contactsFromArticlePlace({
  address: "Минск",
  phone: "+375291112233",
  website: "broken",
  instagramUrl: "https://instagram.com/place",
  mapUrl: "not a URL",
});
assert.equal(mixed.website, undefined);
assert.equal(mixed.mapUrl, undefined);
assert.equal(mixed.phones[0]?.value, "+375291112233");
assert.equal(mixed.socials[0]?.url, "https://instagram.com/place");
assert.equal(mixed.address, "Минск");

console.log("articlePlaceContacts.test.ts: OK");
