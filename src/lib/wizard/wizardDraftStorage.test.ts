/**
 * Тесты ядра useWizardDraft (см. src/hooks/useWizardDraft.ts — тонкая React-обёртка).
 * Запуск: npx tsx src/lib/wizard/wizardDraftStorage.test.ts
 */
import assert from "node:assert/strict";

import {
  WizardDraftAutosaver,
  clearWizardDraft,
  readWizardDraft,
  wizardDraftKey,
  writeWizardDraft,
  type DraftStorage,
  type WizardDraftStatus,
} from "./wizardDraftStorage";

function makeFakeStorage(opts?: { failWrites?: () => boolean }): DraftStorage & {
  map: Map<string, string>;
} {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      if (opts?.failWrites?.()) throw new Error("QuotaExceededError");
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const asyncTests: Array<() => Promise<void>> = [];

// ─── Ключ ─────────────────────────────────────────────────────────────────────

assert.equal(wizardDraftKey("offer", "create"), "mg.wizard.offer:create:new");
assert.equal(wizardDraftKey("offer", "create", null), "mg.wizard.offer:create:new");
assert.equal(wizardDraftKey("route", "edit", "abc123"), "mg.wizard.route:edit:abc123");

// ─── Roundtrip + hasDraft ────────────────────────────────────────────────────

{
  const storage = makeFakeStorage();
  const key = wizardDraftKey("route", "create");

  assert.equal(readWizardDraft(storage, key, 1), null, "пустое хранилище → null");

  const savedAt = writeWizardDraft(storage, key, 1, { title: "Прогулка" });
  const found = readWizardDraft<{ title: string }>(storage, key, 1);
  assert.ok(found, "черновик найден");
  assert.equal(found.data.title, "Прогулка");
  assert.equal(found.savedAt.getTime(), savedAt.getTime());

  clearWizardDraft(storage, key);
  assert.equal(readWizardDraft(storage, key, 1), null, "после clear → null");
}

// ─── schemaVersion-инвалидация ───────────────────────────────────────────────

{
  const storage = makeFakeStorage();
  const key = wizardDraftKey("route", "create");
  writeWizardDraft(storage, key, 1, { title: "v1" });

  assert.equal(
    readWizardDraft(storage, key, 2),
    null,
    "несовпадение schemaVersion → черновик игнорируется",
  );
  assert.equal(storage.map.has(key), false, "несовместимый черновик удалён");
}

// ─── Повреждённый payload ────────────────────────────────────────────────────

{
  const storage = makeFakeStorage();
  const key = wizardDraftKey("route", "create");
  storage.map.set(key, "{not json");
  assert.equal(readWizardDraft(storage, key, 1), null, "битый JSON → null");
  assert.equal(storage.map.has(key), false, "битый черновик удалён");

  storage.map.set(key, JSON.stringify({ schemaVersion: 1, savedAt: "не дата", data: {} }));
  assert.equal(readWizardDraft(storage, key, 1), null, "битая дата → null");
}

// ─── Debounce ────────────────────────────────────────────────────────────────

asyncTests.push(async () => {
  const storage = makeFakeStorage();
  const key = wizardDraftKey("route", "create");
  const statuses: WizardDraftStatus[] = [];
  const saver = new WizardDraftAutosaver<{ n: number }>({
    storage,
    key,
    schemaVersion: 1,
    debounceMs: 30,
    onStatusChange: (s) => statuses.push(s),
  });

  saver.schedule({ n: 1 });
  saver.schedule({ n: 2 });
  await sleep(15);
  saver.schedule({ n: 3 }); // сдвигает таймер
  assert.equal(storage.map.has(key), false, "до истечения debounce записи нет");

  await sleep(50);
  const found = readWizardDraft<{ n: number }>(storage, key, 1);
  assert.ok(found, "после debounce черновик записан");
  assert.equal(found.data.n, 3, "записаны последние данные, одна запись");
  assert.deepEqual(
    statuses,
    ["saving", "saving", "saving", "saved"],
    "статусы: saving на каждый schedule, один saved",
  );
  saver.dispose();
});

// ─── error → retry ───────────────────────────────────────────────────────────

asyncTests.push(async () => {
  let failing = true;
  const storage = makeFakeStorage({ failWrites: () => failing });
  const key = wizardDraftKey("offer", "create");
  const statuses: WizardDraftStatus[] = [];
  const saver = new WizardDraftAutosaver<{ n: number }>({
    storage,
    key,
    schemaVersion: 1,
    debounceMs: 10,
    onStatusChange: (s) => statuses.push(s),
  });

  saver.schedule({ n: 42 });
  await sleep(30);
  assert.equal(statuses.at(-1), "error", "ошибка записи → status error");
  assert.equal(saver.hasPendingWrite, true, "данные не потеряны");

  failing = false;
  saver.retry();
  assert.equal(statuses.at(-1), "saved", "retry → saved");
  const found = readWizardDraft<{ n: number }>(storage, key, 1);
  assert.ok(found && found.data.n === 42, "retry записал последние данные");
  assert.equal(saver.hasPendingWrite, false);

  saver.retry(); // без отложенных данных — no-op
  assert.equal(statuses.at(-1), "saved");
  saver.dispose();
});

// ─── cancel ──────────────────────────────────────────────────────────────────

asyncTests.push(async () => {
  const storage = makeFakeStorage();
  const key = wizardDraftKey("offer", "create");
  const saver = new WizardDraftAutosaver<{ n: number }>({
    storage,
    key,
    schemaVersion: 1,
    debounceMs: 10,
    onStatusChange: () => {},
  });
  saver.schedule({ n: 1 });
  saver.cancel();
  await sleep(30);
  assert.equal(storage.map.has(key), false, "cancel отменяет отложенную запись");
  saver.dispose();
});

void (async () => {
  for (const t of asyncTests) await t();
  console.log("wizardDraftStorage.test.ts: все тесты прошли");
})();
