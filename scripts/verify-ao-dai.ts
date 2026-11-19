import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { configureOfficeStorage, handleApiRequest } from '../server/officeServer';
import { restoreShop } from '../server/officeShop';
import { OFFICE_SHOP, OUTFIT_SLOTS } from '../src/utils/officeShop';

// Isolated storage exercises the same request handler and snapshot format as the Worker.
let snapshot = JSON.stringify({
  dbVersion: 3, accounts: {}, rooms: {}, roomMembers: [], seats: [],
  messages: [], attendance: {}, diaryEntries: [],
});
const events: Record<string, unknown>[] = [];
const storage = {
  save: (value: string) => { snapshot = value; },
  broadcast: (_room: string, event: Record<string, unknown>) => { events.push(event); },
  isOnline: () => true,
  zenStatus: () => false,
  schedule: async () => {},
};
configureOfficeStorage(storage, snapshot);
const server = createServer((request, response) => {
  void handleApiRequest(request, response);
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address === 'object');
const origin = `http://127.0.0.1:${address.port}`;

async function call(path: string, token?: string, body?: unknown) {
  const response = await fetch(origin + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}

try {
  const join = async (nickname: string, avatarGender: string) => {
    const result = await call('/api/auth/join', undefined, {
      roomCode: 'AODAIQA', nickname, avatarGender, createIfMissing: true,
    });
    assert.equal(result.status, 200);
    return result.data.session;
  };
  const a = await join('Áo dài QA', 'male');
  const b = await join('Người quan sát QA', 'female');
  const shopPath = '/api/rooms/AODAIQA/shop';
  const command = (action: string, item?: string) => ({ action, item, id: randomUUID() });
  const initial = (await call(shopPath, a.sessionToken)).data;
  for (const item of ['ao_dai_truc_vang', 'ao_dai_sen_hong'] as const) {
    assert.equal(OUTFIT_SLOTS[item], 'shirt');
    assert.equal(OFFICE_SHOP[item].currency, 'merit');
    const denied = await call(shopPath, b.sessionToken, command('buy', item));
    assert.equal(denied.status, 409);
    assert.equal(denied.data.message, 'Không đủ công đức.');
    const poor = (await call(shopPath, b.sessionToken)).data;
    assert.equal(poor.altarMerit, 0);
    assert.equal(poor.shop.inventory[item], undefined);

    const donation = await call(shopPath, a.sessionToken, { action: 'donate', amount: 1_000_000, id: randomUUID() });
    assert.equal(donation.status, 200);
    const before = donation.data;
    const purchase = command('buy', item);
    const separatePurchase = command('buy', item);
    const [first, retry, repeatedClick] = await Promise.all([
      call(shopPath, a.sessionToken, purchase),
      call(shopPath, a.sessionToken, purchase),
      call(shopPath, a.sessionToken, separatePurchase),
    ]);
    assert.equal(first.status, retry.status);
    assert.deepEqual([first.status, repeatedClick.status].sort(), [200, 409]);
    const successfulPurchase = first.status === 200 ? purchase : separatePurchase;
    let view = (await call(shopPath, a.sessionToken)).data;
    assert.equal(view.altarMerit, before.altarMerit - OFFICE_SHOP[item].price);
    assert.equal(view.balanceVnd, before.balanceVnd);
    assert.equal(view.shop.inventory[item], 1);
    const duplicate = await call(shopPath, a.sessionToken, command('buy', item));
    assert.equal(duplicate.status, 409);
    assert.equal((await call(shopPath, a.sessionToken)).data.altarMerit, view.altarMerit);
    const equip = await call(shopPath, a.sessionToken, command('equip', item));
    assert.equal(equip.status, 200);
    assert.equal(equip.data.shop.equipped.shirt, item);
    const observer = (await call(shopPath, b.sessionToken)).data;
    assert.equal(observer.appearances[a.userId].shirt, item);
    assert.ok(events.some((event) => event.type === 'shop_updated'));

    // Reload the persisted server state, then replay the purchase receipt.
    configureOfficeStorage(storage, snapshot);
    view = (await call(shopPath, a.sessionToken)).data;
    assert.equal(view.shop.inventory[item], 1);
    assert.equal(view.shop.equipped.shirt, item);
    assert.equal((await call(shopPath, a.sessionToken, successfulPurchase)).data.altarMerit, view.altarMerit);
    const restored = restoreShop({ shop: view.shop }).shop.state;
    assert.equal(restored.equipped?.shirt, item);
    const remove = await call(shopPath, a.sessionToken, command('equip', item));
    assert.equal(remove.status, 200);
    assert.equal(remove.data.shop.equipped.shirt, undefined);
  }
  const final = (await call(shopPath, a.sessionToken)).data;
  assert.equal(final.balanceVnd, initial.balanceVnd - 2_000_000);
  // The female avatar uses the same equipment slot, including the male reference outfit.
  await call(shopPath, b.sessionToken, { action: 'donate', amount: 1_000_000, id: randomUUID() });
  for (const item of ['ao_dai_truc_vang', 'ao_dai_sen_hong'] as const) {
    const buy = await call(shopPath, b.sessionToken, command('buy', item));
    assert.equal(buy.status, 200);
    const equip = await call(shopPath, b.sessionToken, command('equip', item));
    assert.equal(equip.data.shop.equipped.shirt, item);
    const observer = (await call(shopPath, a.sessionToken)).data;
    assert.equal(observer.appearances[b.userId].shirt, item);
  }
  configureOfficeStorage(storage, snapshot);
  const persistedB = (await call(shopPath, b.sessionToken)).data;
  assert.equal(persistedB.shop.equipped.shirt, 'ao_dai_sen_hong');
  assert.equal(persistedB.shop.inventory.ao_dai_truc_vang, 1);
  assert.equal(persistedB.shop.inventory.ao_dai_sen_hong, 1);
  console.log('Áo dài API checks passed: merit, insufficient funds, duplicate/retried purchases, equip, observer sync, snapshot reload and restoration.');
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
