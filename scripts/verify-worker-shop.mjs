import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Run with wrangler dev --local. Production URLs are deliberately unsupported.
const origin = 'http://127.0.0.1:8794';
const room = 'SHOP' + Date.now().toString(36).toUpperCase();
async function api(path, token, body) {
  const response = await fetch(origin + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
const health = await api('/api/health');
assert.equal(health.status, 200);
for (const item of ['ao_dai_truc_vang', 'ao_dai_sen_hong']) {
  assert.ok(health.data.shopItems.includes(item));
}
const sessions = [];
for (const avatarGender of ['male', 'female']) {
  const joined = await api('/api/auth/join', undefined, {
    roomCode: room, nickname: 'Kiểm thử ' + avatarGender, avatarGender, createIfMissing: true,
  });
  assert.equal(joined.status, 200);
  sessions.push(joined.data.session);
}
const path = '/api/rooms/' + room + '/shop';
for (const session of sessions) {
  const token = session.sessionToken;
  const initial = await api(path, token);
  const denied = await api(path, token, { action: 'buy', item: 'ao_dai_sen_hong', id: randomUUID() });
  assert.equal(denied.status, 409);
  assert.equal(denied.data.message, 'Không đủ công đức.');
  const colors = { cloth: '#0066cc', trim: '#eeeeee', trousers: '#303030', shoes: '#101010' };
  const unownedColor = await api(path, token, { action: 'customize', item: 'ao_dai_sen_hong', colors, id: randomUUID() });
  assert.equal(unownedColor.status, 409);
  const donated = await api(path, token, { action: 'donate', amount: 1_000_000, id: randomUUID() });
  assert.equal(donated.status, 200);
  let merit = donated.data.altarMerit;
  for (const item of ['ao_dai_truc_vang', 'ao_dai_sen_hong']) {
    const purchase = { action: 'buy', item, id: randomUUID() };
    for (let retry = 0; retry < 2; retry++) {
      const bought = await api(path, token, purchase);
      assert.equal(bought.status, 200, JSON.stringify(bought.data));
      assert.equal(bought.data.shop.inventory[item], 1);
      assert.equal(bought.data.altarMerit, merit - 30);
    }
    merit -= 30;
    const duplicate = await api(path, token, { ...purchase, id: randomUUID() });
    assert.equal(duplicate.status, 409);
    const worn = await api(path, token, { action: 'equip', item, id: randomUUID() });
    assert.equal(worn.status, 200);
    assert.equal(worn.data.shop.equipped.shirt, item);
    const custom = { action: 'customize', item, colors, id: randomUUID() };
    const colored = await api(path, token, custom);
    assert.equal(colored.status, 200);
    assert.deepEqual(colored.data.shop.aoDaiColors[item], colors);
    assert.equal(colored.data.altarMerit, merit);
    assert.equal(colored.data.balanceVnd, worn.data.balanceVnd);
    const replay = await api(path, token, custom);
    assert.equal(replay.status, 200);
    const observer = sessions.find((other) => other.userId !== session.userId);
    const observed = await api(path, observer.sessionToken);
    assert.equal(observed.data.appearances[session.userId].shirt, item);
    assert.deepEqual(observed.data.appearances[session.userId].aoDaiColors[item], colors);
  }
  const final = await api(path, token);
  assert.equal(final.data.balanceVnd, initial.data.balanceVnd - 1_000_000);
}
console.log('Cloudflare Worker shop passed: both outfits, both avatars, buying, free color changes, ownership, replay, equip and observer colors.');
