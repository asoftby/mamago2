import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("event owner edit button is canonical for all publication editors", () => {
  const canonical = source("./OwnerWizardEditDropdown.tsx");
  const event = source("../event-page/OwnerEditDropdown.tsx");
  const offer = source("../offers/OwnerOfferEditDropdown.tsx");
  const publicOffer = source("../offers/PublicOfferHero.tsx");
  assert.match(canonical, /h-14 w-full rounded-full border-black bg-black/);
  assert.match(canonical, /label = "Редактировать"/);
  assert.match(canonical, /returnTo=/);
  assert.match(event, /<OwnerWizardEditDropdown steps=\{steps\}/);
  assert.match(offer, /<OwnerWizardEditDropdown steps=\{steps\}/);
  assert.match(publicOffer, /<SidebarCardTopSection mt=\{20\} pt=\{20\}>\{ownerEditSlot\}<\/SidebarCardTopSection>/);
});
