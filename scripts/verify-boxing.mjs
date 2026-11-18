import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const origin = process.argv[2] ?? 'http://127.0.0.1:8795';
const room = 'BOX' + randomUUID().slice(0, 8).toUpperCase();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function api(route, token, body) {
  const response = await fetch(origin + route, {
    method: body ? 'POST' : 'GET',
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: 'Bearer ' + token }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}
const join = (nickname) => api('/api/auth/join', undefined, {
  nickname, password: 'Office boxing test only', roomCode: room, createIfMissing: true,
});
const [a, b] = await Promise.all([join('Boxing QA A'), join('Boxing QA B')]).then((users) => users.map(({ session }) => session));
const endpoint = '/api/rooms/' + room;
const boxing = (who, body) => api(endpoint + '/boxing', who.sessionToken, body);
const move = (who, zone, x, z) => boxing(who, { action: 'move', zone, x, z });
const attack = (who, id = randomUUID()) => boxing(who, { action: 'punch', id });
const bell = (who) => api(endpoint + '/altar', who.sessionToken, { action: 'merit', practice: 'bell' });

const sockets = [];
try {
  const streams = await Promise.all([a, b].map((player) => new Promise((resolve, reject) => {
    const messages = [];
    const url = origin.replace(/^http/, 'ws') + endpoint + '/events?token=' + encodeURIComponent(player.sessionToken);
    const socket = new WebSocket(url);
    sockets.push(socket);
    socket.addEventListener('error', reject, { once: true });
    socket.addEventListener('message', (event) => {
      const update = JSON.parse(event.data);
      if (update.type === 'boxing_updated') messages.push(update);
    });
    socket.addEventListener('open', () => resolve(messages), { once: true });
  })));
  for (let i = 0; i < 5; i++) {
    await bell(a);
    if (i < 4) await pause(635);
  }
  await move(a, 'boxing', -3, 17.2);
  await move(b, 'boxing', -1.05, 17.2);
  const ring = await attack(a);
  assert.equal(ring.hits.at(-1).target, b.userId);
  assert.equal(ring.merit, 5);
  assert.equal((await boxing(b)).merit, 0);
  console.log('Ring hit is shared and free of merit cost');

  await move(a, 'office', 0, 0);
  await move(b, 'office', 1.95, 0);
  await pause(440);
  const officeId = randomUUID();
  const attempts = await Promise.all([attack(a, officeId), attack(a, officeId)]);
  assert.equal(attempts[0].hits.filter((hit) => hit.id === officeId && hit.target === b.userId).length, 1);
  assert.equal((await boxing(a)).merit, 0);
  assert.equal((await boxing(b)).merit, 0);
  await pause(440);
  assert.equal((await attack(a, officeId)).merit, 0);
  const unfunded = await attack(a);
  assert.equal(unfunded.hits.at(-1).target, undefined);
  await bell(a);
  await move(b, 'office', 2.4, 0);
  await pause(440);
  const miss = await attack(a);
  assert.equal(miss.hits.at(-1).target, undefined);
  assert.equal(miss.merit, 1);
  console.log('Office hit charges exactly five once; replay, low merit and miss do not charge');

  await move(a, 'boxing', 3.35, 18.0);
  await move(b, 'boxing', 5.3, 17.35);
  await pause(440);
  const first = await Promise.all([attack(a), attack(b)]);
  assert.equal((await boxing(a)).fishHp, 36);
  assert.equal((await boxing(b)).fishHp, 36);
  assert.ok(first.some((view) => view.hits.some((hit) => hit.attacker === 'boxing-fish' && hit.target)));
  assert.equal((await boxing(a)).merit, 1);
  assert.equal((await boxing(b)).merit, 0);
  await pause(440);
  await Promise.all([attack(a), attack(b)]);
  await pause(440);
  await attack(a);
  const down = await boxing(b);
  assert.equal(down.fishHp, 0);
  assert.ok(down.fishRecoverAt > 0);
  await attack(b);
  assert.equal((await boxing(b)).fishRecoverAt, down.fishRecoverAt);
  await move(b, 'away');
  assert.ok(!(b.userId in (await boxing(a)).fighters));
  await pause(Math.max(0, down.fishRecoverAt - Date.now() + 250));
  assert.equal((await boxing(a)).fishHp, 60);
  await move(b, 'boxing', 3.8, 17.35);
  assert.equal((await boxing(b)).fishHp, 60);
  await pause(100);
  for (const updates of streams) {
    assert.ok(updates.some((state) => state.hits.some((hit) => hit.id === officeId)));
    assert.ok(updates.some((state) => state.fishHp === 0));
    assert.ok(updates.some(({ serverTime, fishHp }) => serverTime >= down.fishRecoverAt && fishHp === 60));
  }
  console.log('Both sockets saw shared HP, a non-damaging counter, KO, and recovery; leaving and rejoining works');
} finally {
  sockets.forEach((socket) => socket.close());
}
