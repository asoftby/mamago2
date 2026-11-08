/** Sequential real Chrome acceptance against the guarded demo database. No production fixture APIs. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { chromium, type Page, type BrowserContext } from 'playwright-core';
import { PrismaClient, type PartyItemRole } from '@prisma/client';
import { assertBirthdayDemoEnvironment } from './guard';
import { demoId, demoDates, DEMO_PASSWORD } from './catalog';
import { replyToPartyRequest } from '../../../src/server/birthday/partyBusiness.service';
import { confirmPartyRequest } from '../../../src/server/birthday/partyConfirm.service';
import appPrisma from '../../../src/lib/prisma';

assertBirthdayDemoEnvironment(process.env);
async function main() {
const base = 'http://127.0.0.1:34357';
const db = new PrismaClient();
const directory = 'artifacts/birthday-journey';
const results: Array<{ id: string; expected: string; actual: string; status: 'PASS' | 'FAIL' | 'BLOCKED'; evidence?: string }> = [];
const executablePath = process.env.BIRTHDAY_CHROME_PATH;
assert.ok(executablePath, 'Set BIRTHDAY_CHROME_PATH to an installed Chrome executable; never silently skip browser acceptance');
const browser = await chromium.launch({ executablePath, headless: true });
const contexts: BrowserContext[] = [];
let page: Page;
let orderA: string | undefined;
let orderB: string | undefined;
async function eventually(check: () => Promise<boolean>, message: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(message);
}
async function step(id: string, expected: string, run: () => Promise<string>) {
  try {
    const actual = await run();
    results.push({ id, expected, actual, status: 'PASS', evidence: `${id}.png` });
    if (page) await page.screenshot({ path: `${directory}/${id}.png` });
  } catch (error) {
    results.push({ id, expected, actual: String(error), status: 'FAIL', evidence: `${id}-failure.png` });
    if (page) await page.screenshot({ path: `${directory}/${id}-failure.png` }).catch(() => {});
  }
  await writeFile(`${directory}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.at(-1)));
}
function blocked(id: string, expected: string, actual: string) {
  results.push({ id, expected, actual, status: 'BLOCKED' });
}
async function login(account: string) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  contexts.push(context);
  const p = await context.newPage();
  p.setDefaultTimeout(30_000);
  await p.goto(base + '/login?redirectTo=%2Fminsk%2Fbirthday%2Fmake', { waitUntil: 'networkidle' });
  await p.getByRole('textbox', { name: 'Email', exact: true }).fill(account + '@birthday-demo.test');
  await p.locator('input[type="password"]').fill(DEMO_PASSWORD);
  await p.getByRole('button', { name: 'Войти', exact: true }).last().click();
  await p.waitForURL((url) => url.pathname === '/minsk/birthday/make');
  await p.waitForLoadState('networkidle');
  return p;
}
const title = (name: string) => name + ' [ДЕМО]';
const card = (p: Page, name: string) => p.locator('article').filter({ has: p.getByRole('heading', { name: title(name), exact: true }) });
async function pick(p: Page, name: string) { await card(p, name).getByRole('button', { name: /Выбрать основу|Добавить/, exact: true }).click(); }
async function wizard(p: Page, anchor: string, addons: string[] = [], format = 'В заведении') {
  await p.goto(base + '/minsk/birthday/make', { waitUntil: 'networkidle' });
  const date = demoDates().partyDate;
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Minsk' }));
  const target = new Date(date + 'T12:00:00');
  const months = (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth();
  for (let i = 0; i < months; i++) await p.getByRole('button', { name: 'Следующий месяц' }).click();
  const day = p.getByRole('button', { name: String(target.getDate()), exact: true });
  await day.click(); await day.click();
  await p.getByRole('button', { name: 'Далее — для кого', exact: true }).click();
  await p.getByRole('button', { name: /Другой человек · свободный выбор/ }).click();
  await p.getByPlaceholder('Имя именинника', { exact: true }).fill('Тестовый именинник');
  await p.getByRole('spinbutton', { name: 'Возраст на дату праздника (необязательно)', exact: true }).fill('8');
  await p.getByRole('button', { name: 'Выбрать', exact: true }).click();
  await p.getByRole('button', { name: '5–10 гостей', exact: true }).click();
  await p.getByRole('button', { name: 'Далее — формат', exact: true }).click();
  await p.getByRole('button', { name: new RegExp(format) }).click();
  await p.getByRole('button', { name: /1000.*и выше/ }).click();
  await p.getByRole('button', { name: 'Далее — подбор', exact: true }).click();
  await pick(p, anchor);
  for (const name of addons) await pick(p, name);
  await p.reload({ waitUntil: 'networkidle' });
  await p.getByRole('heading', { name: 'Соберите ваш праздник', exact: true }).waitFor();
  assert.equal(await p.getByRole('heading', { name: title('Тематический персонаж'), exact: true }).count(), 0, 'age filter must survive reload');
  await p.getByRole('button', { name: 'Далее — обзор', exact: true }).click();
  await p.getByRole('heading', { name: 'Вы выбрали услуги', exact: true }).waitFor();
  await p.getByRole('button', { name: 'Сохранить состав', exact: true }).waitFor({ state: 'visible' });
}
async function mutation(p: Page, action: () => Promise<unknown>) {
  const pending = p.waitForResponse(response => response.url().startsWith(base + '/api/parent/parties/') && response.request().method() === 'PATCH');
  await action();
  const response = await pending;
  assert.equal(response.status(), 200, await response.text());
  return await response.json() as { id: string; version: number; estimate?: { minimumByn: number } };
}
async function form(p: Page) {
  const childName = p.getByLabel('Имя ребёнка', { exact: true });
  if (await childName.count()) await childName.fill('Тестовый именинник');
  const childAge = p.getByLabel('Возраст ребёнка на дату праздника', { exact: true });
  if (await childAge.count()) await childAge.fill('8');
  await p.getByLabel('Начало', { exact: true }).fill('14:00');
  await p.getByLabel('Окончание', { exact: true }).fill('16:00');
  await p.getByLabel('Количество детей', { exact: true }).fill('8');
  await p.getByLabel('Количество взрослых', { exact: true }).fill('3');
  await p.getByLabel('Ваше имя', { exact: true }).fill('Тестовый родитель');
  await p.getByLabel('Телефон', { exact: true }).fill('+375291112233');
}
async function submit(p: Page, id: string) {
  await form(p);
  await p.getByRole('button', { name: /Отправить заявку|Запросить согласование пакета/, exact: false }).click();
  await p.getByRole('link', { name: /Открыть праздник/ }).waitFor();
  const party = await db.partyOrder.findUniqueOrThrow({ where: { id } });
  assert.equal(party.timeFrom, '14:00'); assert.equal(party.timeTo, '16:00');
  assert.notEqual(party.status, 'DRAFT');
  await p.goto(base + '/me/birthdays/' + id, { waitUntil: 'networkidle' });
}
async function requestFor(id: string, role: PartyItemRole = 'ANCHOR') {
  return db.bookingRequest.findFirstOrThrow({ where: { partyOrderItem: { partyOrderId: id, role } }, orderBy: { createdAt: 'desc' } });
}
async function widths(p: Page, prefix: string) {
  for (const width of [320, 375, 390, 768, 1200]) {
    await p.setViewportSize({ width, height: 900 });
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${prefix} overflow at ${width}`);
    await p.screenshot({ path: `${directory}/${prefix}-${width}.png` });
  }
}
try {
  await mkdir(directory, { recursive: true });
  page = await login('parent');
  await step('A', 'Compose five services, replace/remove/return, server estimate and reload preserve composition', async () => {
    await wizard(page, 'Творческая студия', ['Аниматор', 'Готовый торт', 'Воздушные шары', 'Фотограф']);
    const saved = await mutation(page, () => page.getByRole('button', { name: 'Сохранить состав', exact: true }).click());
    orderA = saved.id; assert.equal(saved.estimate?.minimumByn, 750);
    const animator = page.locator('div.flex.flex-wrap.items-center.justify-between').filter({ has: page.getByRole('heading', { name: title('Аниматор'), exact: true }) }).first();
    await animator.getByRole('button', { name: 'Заменить', exact: true }).click();
    await page.getByLabel('Новая услуга взамен выбранной').selectOption(demoId('animator-2'));
    // One controlled API failure must not lose any server-owned selection.
    const beforeFailure = await db.partyOrderItem.findMany({ where: { partyOrderId: saved.id }, orderBy: { id: 'asc' } });
    const routePattern = '**/api/parent/parties/' + saved.id;
    await page.route(routePattern, route => route.request().method() === 'PATCH'
      ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Тестовая ошибка API' }) })
      : route.continue());
    await page.getByRole('button', { name: 'Сохранить замену', exact: true }).click();
    await page.getByText('Тестовая ошибка API', { exact: true }).waitFor();
    await page.unroute(routePattern);
    assert.deepEqual(await db.partyOrderItem.findMany({ where: { partyOrderId: saved.id }, orderBy: { id: 'asc' } }), beforeFailure);
    await mutation(page, () => page.getByRole('button', { name: 'Сохранить замену', exact: true }).click());
    const photo = page.locator('div.flex.flex-wrap.items-center.justify-between').filter({ has: page.getByRole('heading', { name: title('Фотограф'), exact: true }) }).first();
    await mutation(page, () => photo.getByRole('button', { name: 'Удалить', exact: true }).click());
    await page.getByLabel('Дополнительная услуга', { exact: true }).selectOption(demoId('photo-1'));
    const returned = await mutation(page, () => page.getByRole('button', { name: 'Добавить', exact: true }).click());
    assert.equal(returned.estimate?.minimumByn, 800);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: title('Ведущий'), exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: title('Аниматор'), exact: true }).count(), 0);
    assert.equal(await db.partyOrderItem.count({ where: { partyOrderId: saved.id } }), 5);
    await widths(page, 'review');
    await submit(page, saved.id);
    return `PartyOrder ${saved.id}; five items; minimum 800 BYN; real submit at 14–16`;
  });
  await step('C-accept', 'Business quote accepted by parent, resource confirmation remains separate and idempotent', async () => {
    assert.ok(orderA, 'A prerequisite');
    const request = await requestFor(orderA);
    const reply = await replyToPartyRequest({ businessId: demoId('business-2'), actorUserId: demoId('owner-2'), requestId: request.id,
      idempotencyKey: randomUUID(), input: { type: 'MODIFIED', expectedStage: 'SENT', expectedQuoteVersion: 0, priceByn: 370,
        includes: 'Площадка по запросу', changeReason: 'Уточнение цены площадки' } });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Принять предложение', exact: true }).click();
    await eventually(async () => (await db.partyQuote.findUniqueOrThrow({ where: { id: reply.quote.id } })).status === 'ACCEPTED', 'quote acceptance not saved');
    assert.equal(await db.bookingAllocation.count({ where: { bookingRequestId: request.id, status: 'CONFIRMED' } }), 0);
    const confirm = { businessId: demoId('business-2'), actorUserId: demoId('owner-2'), requestId: request.id,
      expectedQuoteVersion: reply.quote.version, idempotencyKey: randomUUID(), bookingUnitId: demoId('unit-venue-2') };
    await confirmPartyRequest(confirm); assert.equal((await confirmPartyRequest(confirm)).alreadyConfirmed, true);
    assert.equal(await db.bookingAllocation.count({ where: { bookingRequestId: request.id, status: 'CONFIRMED' } }), 1);
    await page.reload({ waitUntil: 'networkidle' });
    return `Quote ${reply.quote.id} accepted; one canonical allocation, replay preserved`;
  });
  await step('D-decline', 'A declined add-on preserves the already confirmed venue and its allocation', async () => {
    assert.ok(orderA, 'A prerequisite');
    const anchor = await requestFor(orderA);
    assert.equal(anchor.partyStage, 'CONFIRMED');
    const request = await db.bookingRequest.findFirstOrThrow({ where: { partyOrderItem: { partyOrderId: orderA, category: 'PHOTO', role: 'STANDALONE' } } });
    await replyToPartyRequest({ businessId: demoId('business-1'), actorUserId: demoId('owner-1'), requestId: request.id,
      idempotencyKey: randomUUID(), input: { type: 'DECLINED', expectedStage: 'SENT', expectedQuoteVersion: 0, declineReason: 'DATE_BUSY' } });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('Исполнитель отказал', { exact: true }).waitFor();
    assert.equal((await requestFor(orderA)).partyStage, 'CONFIRMED');
    assert.equal(await db.bookingAllocation.count({ where: { bookingRequestId: anchor.id, status: 'CONFIRMED' } }), 1);
    return 'Actual provider decline; confirmed anchor and one allocation preserved; replacement itself remains BLOCKED';
  });
  await step('E', 'Selected active adult and real child see shared programme through My Plan', async () => {
    assert.ok(orderA, 'A prerequisite');
    await page.goto(base + '/me/birthdays/' + orderA, { waitUntil: 'networkidle' });
    await page.getByText('Участники семьи', { exact: true }).click();
    await page.getByLabel('Демо Второй взрослый', { exact: true }).check();
    await page.getByLabel('Тестовый ребёнок (профиль ребёнка)', { exact: true }).check();
    await mutation(page, () => page.getByRole('button', { name: 'Сохранить участников', exact: true }).click());
    await mutation(page, () => page.getByRole('button', { name: 'Сохранить в мой план', exact: true }).click());
    const first = await db.partyOrder.findUniqueOrThrow({ where: { id: orderA } });
    await mutation(page, () => page.getByRole('button', { name: 'Обновить в моём плане', exact: true }).click());
    assert.equal((await db.partyOrder.findUniqueOrThrow({ where: { id: orderA } })).planItemId, first.planItemId);
    const adult = await login('adult');
    await adult.goto(base + '/me/plan?date=' + demoDates().partyDate, { waitUntil: 'networkidle' });
    await adult.locator(`a[href="/me/birthdays/${orderA}"]`).first().click();
    await adult.getByRole('heading', { name: /Программа/ }).first().waitFor();
    assert.equal(await adult.getByRole('button', { name: 'Принять предложение', exact: true }).count(), 0);
    await widths(adult, 'family');
    await adult.context().close();
    return `Same PlanItem ${first.planItemId}; adult calendar deeplink, read-only programme`;
  });
  await step('F', 'Explicit anonymous capability, redaction/noindex, rotation/revoke returns HTTP 404', async () => {
    assert.ok(orderA, 'A prerequisite');
    await page.goto(base + '/me/birthdays/' + orderA, { waitUntil: 'networkidle' });
    await page.getByText('Публичная ссылка', { exact: true }).click();
    await mutation(page, () => page.getByRole('button', { name: 'Разрешить просмотр по ссылке', exact: true }).click());
    const path = await page.getByRole('link', { name: 'Предпросмотр для гостей', exact: true }).getAttribute('href');
    assert.ok(path?.startsWith('/p/'));
    const anonymous = await browser.newContext(); contexts.push(anonymous);
    const publicPage = await anonymous.newPage();
    const response = await publicPage.goto(base + path, { waitUntil: 'networkidle' });
    assert.equal(response?.status(), 200);
    const text = await publicPage.locator('body').innerText();
    for (const secret of ['Тестовый ребёнок', 'Тестовый именинник', '+375291112233', 'BYN', 'Тестовый родитель']) assert.ok(!text.includes(secret), secret);
    assert.match(await publicPage.locator('meta[name="robots"]').getAttribute('content') ?? '', /noindex/);
    assert.equal(await publicPage.locator('input,button[type="submit"]').count(), 0);
    assert.equal(await publicPage.locator('script[src*="googletagmanager"],script[src*="google-analytics"]').count(), 0);
    await widths(publicPage, 'public');
    await mutation(page, () => page.getByRole('button', { name: 'Отозвать ссылку', exact: true }).click());
    assert.equal((await publicPage.reload({ waitUntil: 'networkidle' }))?.status(), 404);
    await anonymous.close();
    return 'Anonymous actual HTTP200 then revoked HTTP404; bounded redacted programme at all widths';
  });
  await step('B', 'All component rules, another provider replacement, frozen server estimate and reload', async () => {
    page = await login('parent');
    await wizard(page, 'А. Всё включено');
    const saved = await mutation(page, () => page.getByRole('button', { name: 'Сохранить состав', exact: true }).click());
    orderB = saved.id;
    const component = (label: string) => page.getByRole('region', { name: 'Состав пакета', exact: true }).locator('div.rounded-md').filter({ has: page.getByText(label, { exact: true }) });
    assert.equal(await component('Площадка').getByRole('button').count(), 0);
    await mutation(page, () => component('Торт пакета').getByRole('button', { name: 'Убрать', exact: true }).click());
    await component('Аниматор пакета').getByRole('button', { name: 'Заменить', exact: true }).click();
    await page.getByLabel('Услуга другого исполнителя', { exact: true }).selectOption(demoId('animator-2'));
    const changed = await mutation(page, () => page.getByRole('button', { name: 'Сохранить замену', exact: true }).click());
    assert.equal(changed.estimate?.minimumByn, 950);
    await mutation(page, () => component('Фотограф пакета').getByRole('button', { name: 'Убрать', exact: true }).click());
    await mutation(page, () => component('Декор пакета').getByRole('button', { name: 'Сохранить запрос', exact: true }).click());
    const before = await db.partyOrderItem.findMany({ where: { partyOrderId: saved.id }, orderBy: { id: 'asc' } });
    await page.reload({ waitUntil: 'networkidle' });
    await component('Аниматор пакета').getByRole('button', { name: 'Вернуть компонент', exact: true }).waitFor();
    const after = await db.partyOrderItem.findMany({ where: { partyOrderId: saved.id }, orderBy: { id: 'asc' } });
    assert.deepEqual(after, before);
    await widths(page, 'package');
    await submit(page, saved.id);
    const request = await requestFor(saved.id);
    assert.ok(request.bookingPriceSnapshot);
    return `VENUE PartyOrder ${saved.id}; snapshots unchanged on reload; real edited-package submit`;
  });
  await step('C-reject', 'Parent rejects business package quote; no resource or third-party service is falsely confirmed', async () => {
    assert.ok(orderB, 'B prerequisite');
    const request = await requestFor(orderB);
    await replyToPartyRequest({ businessId: demoId('business-1'), actorUserId: demoId('owner-1'), requestId: request.id,
      idempotencyKey: randomUUID(), input: { type: 'MODIFIED', expectedStage: 'SENT', expectedQuoteVersion: 0,
        priceByn: 780, includes: 'Изменённый состав без исключённых услуг', changeReason: 'Уточнена стоимость изменённого пакета' } });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Отклонить предложение', exact: true }).click();
    await eventually(async () => (await db.partyOrder.findUniqueOrThrow({ where: { id: orderB } })).status === 'NEEDS_ALTERNATIVE', 'rejection not saved');
    assert.equal(await db.bookingAllocation.count({ where: { bookingRequestId: request.id, status: 'CONFIRMED' } }), 0);
    assert.equal(await db.partyOrderItem.count({ where: { partyOrderId: orderB, role: 'STANDALONE', status: 'CONFIRMED' } }), 0);
    return 'Rejected through UI; NEEDS_ALTERNATIVE, no confirmed allocation/third-party replacement';
  });
  await step('G', 'Cancel unconfirmed order and build a distinct order in the same browser session', async () => {
    assert.ok(orderB, 'B prerequisite');
    await page.goto(base + '/me/birthdays/' + orderB, { waitUntil: 'networkidle' });
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Отменить праздник', exact: true }).click();
    await eventually(async () => (await db.partyOrder.findUniqueOrThrow({ where: { id: orderB } })).status === 'CANCELLED', 'cancellation not saved');
    const requests = await db.bookingRequest.count({ where: { partyOrderItem: { partyOrderId: orderB } } });
    await wizard(page, 'Игровая комната');
    const next = await mutation(page, () => page.getByRole('button', { name: 'Сохранить состав', exact: true }).click());
    assert.notEqual(next.id, orderB); assert.notEqual(next.id, orderA);
    assert.equal(await db.bookingRequest.count({ where: { partyOrderItem: { partyOrderId: orderB } } }), requests);
    assert.equal(await db.bookingRequest.count({ where: { partyOrderItem: { partyOrderId: next.id } } }), 0);
    return `Cancelled ${orderB}; new draft ${next.id}; no new old-order requests`;
  });
  for (const [format, anchor, label] of [['Дома', 'В. Праздник дома', 'H-home'], ['На природе', 'Г. Праздник на природе', 'H-outdoor']]) {
    await step(label, 'Mobile package edits remain saved but unsupported submission stays disabled', async () => {
      page = await login('parent');
      await wizard(page, anchor, [], format);
      const saved = await mutation(page, () => page.getByRole('button', { name: 'Сохранить состав', exact: true }).click());
      await mutation(page, () => page.getByRole('button', { name: 'Сохранить запрос', exact: true }).first().click());
      await page.getByText('Согласование изменений выездного пакета пока недоступно. Состав сохранён в черновике.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: /Отправить заявку|Запросить согласование пакета/ }).isDisabled(), true);
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByText('Согласование изменений выездного пакета пока недоступно. Состав сохранён в черновике.', { exact: true }).waitFor();
      assert.equal((await db.partyOrder.findUniqueOrThrow({ where: { id: saved.id } })).status, 'DRAFT');
      return `Guard verified through actual ${format} wizard; saved draft ${saved.id}, no forced state`;
    });
  }
  await step('C-expiry-concurrency', 'Expired quote cannot be accepted; authenticated concurrent PATCH has one winner', async () => {
    // Setup through existing owner API, not a new fixture endpoint or fabricated confirmation.
    page = await login('parent');
    const createdResponse = await page.request.post(base + '/api/parent/parties', { data: { citySlug: 'minsk', venueMode: 'VENUE' } });
    assert.equal(createdResponse.status(), 201);
    const created = await createdResponse.json();
    const path = base + '/api/parent/parties/' + created.id;
    const races = await Promise.all(['A', 'B'].map(contactName => page.request.patch(path, { data: { version: created.version, contactName } })));
    assert.deepEqual(races.map(response => response.status()).sort(), [200, 409]);
    const current = await (await page.request.get(path)).json();
    const chosen = await page.request.patch(path, { data: { version: current.version, anchorOfferId: demoId('venue-1'), addonOfferIds: [],
      eventDate: demoDates().partyDate, timeFrom: '16:00', timeTo: '18:00', childrenCount: 8, adultsCount: 3,
      contactName: 'Тестовый родитель', contactPhone: '+375291112233' } });
    assert.equal(chosen.status(), 200);
    const draft = await chosen.json();
    const sent = await page.request.post(path + '/submit', { headers: { 'Idempotency-Key': randomUUID() }, data: { version: draft.version } });
    assert.equal(sent.status(), 201);
    const request = await requestFor(created.id);
    const quote = await replyToPartyRequest({ businessId: demoId('business-1'), actorUserId: demoId('owner-1'), requestId: request.id,
      idempotencyKey: randomUUID(), input: { type: 'MODIFIED', expectedStage: 'SENT', expectedQuoteVersion: 0, priceByn: 260,
        includes: 'Тестовая площадка', changeReason: 'Уточнение цены площадки' } });
    // Expiry is the only clock fixture write; all business transitions use canonical services.
    await db.partyQuote.update({ where: { id: quote.quote.id }, data: { validUntil: new Date(Date.now() - 1000) } });
    await page.goto(base + '/me/birthdays/' + created.id, { waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('button', { name: 'Принять предложение', exact: true }).count(), 0);
    const stale = await page.request.post(path + '/quotes/' + quote.quote.id + '/accept', { data: { requestId: request.id, expectedVersion: quote.quote.version } });
    assert.equal(stale.status(), 409);
    assert.equal(await db.bookingAllocation.count({ where: { bookingRequestId: request.id } }), 0);
    return 'Real owner HTTP PATCH race: 200/409; expired quote hidden in browser and rejected HTTP409, zero allocation';
  });
  blocked('D-replace'  , 'Alternative provider after a decline preserves confirmed services', 'Post-submission replacement mutation is not integrated; Draft #1148 remains unmerged. No unsafe substitute process created.');
  blocked('H-package-change', 'Changed HOME/OUTDOOR package can be submitted through supported contract', 'Mobile changed-package submit is deliberately unsupported; browser must retain truthful disabled state.');
} finally {
  await writeFile(`${directory}/results.json`, JSON.stringify(results, null, 2));
  await Promise.allSettled(contexts.map(context => context.close()));
  await browser.close(); await db.$disconnect(); await appPrisma.$disconnect();
}
if (results.some(result => result.status === 'FAIL')) process.exitCode = 1;

}
main().catch(error => { console.error(error); process.exitCode = 1; });
