import assert from "node:assert/strict";
import test from "node:test";
import { SharedContactsDataSchema, contactsFromPlace, formatAddressFromGoogleComponents, normalizeSharedContactsData } from "./structuredContacts";

test("accepts empty contacts and survives a JSON roundtrip", () => {
  const contacts = normalizeSharedContactsData({});
  assert.deepEqual(contacts, { phones: [], socials: [] });
  assert.deepEqual(SharedContactsDataSchema.parse(JSON.parse(JSON.stringify(contacts))), contacts);
});

test("normalizes text and exact duplicates while preserving input order", () => {
  const contacts = normalizeSharedContactsData({
    address: "  пр-т Победителей, 1 ",
    phones: [
      { value: " +375 29 111-11-11 ", label: " Администратор " },
      { value: "+375 29 111-11-11" },
      { value: "+375 17 222-22-22" },
    ],
    socials: [
      { kind: "telegram", url: " https://t.me/mamago " },
      { kind: "other", url: "https://t.me/mamago" },
    ],
  });
  assert.equal(contacts.address, "пр-т Победителей, 1");
  assert.deepEqual(contacts.phones.map((phone) => phone.value), ["+375 29 111-11-11", "+375 17 222-22-22"]);
  assert.equal(contacts.phones[0].label, "Администратор");
  assert.equal(contacts.socials.length, 1);
});

test("validates website and social URLs", () => {
  assert.throws(() => normalizeSharedContactsData({ website: "not a url" }));
  assert.throws(() => normalizeSharedContactsData({ socials: [{ kind: "vk", url: "vk" }] }));
});

test("adapts current Place scalar contacts without Prisma coupling", () => {
  const contacts = contactsFromPlace({
    address: " ул. Ленина, 10 ",
    phone: "+375 29 100-00-00",
    phoneLabel: "Основной",
    phone2: "+375 17 200-00-00",
    website: "https://example.com",
    instagramUrl: "https://instagram.com/example",
    lat: 53.9,
    lng: 27.56,
  });
  assert.equal(contacts.phones.length, 2);
  assert.deepEqual(contacts.socials, [{ kind: "instagram", url: "https://instagram.com/example" }]);
  assert.deepEqual(contacts.coordinates, { latitude: 53.9, longitude: 27.56 });
});

test("does not synthesize coordinates from null or partial Place pairs", () => {
  assert.equal(contactsFromPlace({ lat: null, lng: null }).coordinates, undefined);
  assert.equal(contactsFromPlace({ lat: 53.9, lng: null }).coordinates, undefined);
});

test("formats city/street/house from Google address_components, not from formatted_address", () => {
  const full = formatAddressFromGoogleComponents(
    [
      { long_name: "5", short_name: "5", types: ["street_number"] },
      { long_name: "Мястровская улица", short_name: "Мястровская", types: ["route"] },
      { long_name: "Минск", short_name: "Минск", types: ["locality", "political"] },
      { long_name: "Беларусь", short_name: "BY", types: ["country", "political"] },
    ],
    "some fallback",
  );
  assert.equal(full, "г.Минск, ул.Мястровская улица, 5");
});

test("degrades gracefully when a component is missing, still anchored on locality", () => {
  const noHouse = formatAddressFromGoogleComponents(
    [
      { long_name: "Мястровская улица", short_name: "Мястровская", types: ["route"] },
      { long_name: "Минск", short_name: "Минск", types: ["locality", "political"] },
    ],
    "fallback",
  );
  assert.equal(noHouse, "г.Минск, ул.Мястровская улица");

  const cityOnly = formatAddressFromGoogleComponents(
    [{ long_name: "Минск", short_name: "Минск", types: ["locality", "political"] }],
    "fallback",
  );
  assert.equal(cityOnly, "г.Минск");
});

test("falls back to the raw address when there is no locality to anchor on", () => {
  assert.equal(
    formatAddressFromGoogleComponents(
      [{ long_name: "Мястровская улица", short_name: "Мястровская", types: ["route"] }],
      "Мястровская улица, 5",
    ),
    "Мястровская улица, 5",
  );
  assert.equal(formatAddressFromGoogleComponents([], "raw text"), "raw text");
});
