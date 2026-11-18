import { BOXING, FISH_ID, inBoxingRing, type BoxingHit, type BoxingPosition, type BoxingView } from '../src/utils/boxing';

export interface BoxingState {
  hp: number;
  recoverAt: number;
  counterAt: number;
  hits: BoxingHit[];
  lastPunched: Record<string, number>;
  receipts: Record<string, true>;
}

type Presence = BoxingPosition & { at: number };
const nearby = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);
const fish = { x: BOXING.fishX, z: BOXING.fishZ };

export const createBoxingState = (): BoxingState => ({
  hp: BOXING.maxHp, recoverAt: 0, counterAt: 0, hits: [], lastPunched: {}, receipts: {},
});

export function updateFighter(fighters: Record<string, Presence>, id: string, zone: unknown, x: unknown, z: unknown, now: number) {
  if (zone === 'away') {
    delete fighters[id];
    return true;
  }
  if ((zone !== 'office' && zone !== 'boxing') || typeof x !== 'number' || typeof z !== 'number' ||
      !Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (zone === 'boxing' ? Math.abs(x) > BOXING.width / 2 || Math.abs(z - BOXING.centerZ) > BOXING.depth / 2 :
      Math.abs(x) > 8 || Math.abs(z) > 5.6) return false;
  const previous = fighters[id];
  if (previous?.zone === zone && now - previous.at < BOXING.presenceMs &&
      nearby(previous, { x, z }) > 0.85 + (now - previous.at) * 0.0048) return false;
  fighters[id] = { zone, x, z, at: now };
  return true;
}

export function activeFighters(fighters: Record<string, Presence>, now: number) {
  for (const [id, player] of Object.entries(fighters)) {
    if (now - player.at > BOXING.presenceMs) delete fighters[id];
  }
  return fighters;
}

export function recoverFish(state: BoxingState, now: number) {
  if (!state.recoverAt || now < state.recoverAt) return false;
  state.hp = BOXING.maxHp;
  state.recoverAt = 0;
  return true;
}

export function punch(state: BoxingState, fighters: Record<string, Presence>, id: string, requestId: string, now: number,
  debit: () => boolean): BoxingHit | undefined {
  const receipt = id + ':' + requestId;
  if (Object.hasOwn(state.receipts, receipt) || now - (state.lastPunched[id] ?? -Infinity) < BOXING.punchDelayMs) return;
  state.receipts[receipt] = true;
  state.lastPunched[id] = now;
  const actor = activeFighters(fighters, now)[id];
  if (!actor) return;
  const hit: BoxingHit = { id: requestId, attacker: id, at: now };
  const ring = actor.zone === 'boxing' && inBoxingRing(actor);
  const opponents = Object.entries(fighters)
    .filter(([other, position]) => other !== id && actor.zone === position.zone &&
      (actor.zone === 'office' || (ring && inBoxingRing(position))))
    .map(([other, position]) => ({ id: other, distance: nearby(actor, position) }))
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
  const candidate = opponents[0];
  if (candidate && candidate.distance <= BOXING.punchRange && (ring || debit())) hit.target = candidate.id;
  else if (actor.zone === 'boxing' && !ring && nearby(actor, fish) <= BOXING.punchRange && !state.recoverAt) {
    hit.target = FISH_ID;
    state.hp = Math.max(0, state.hp - BOXING.damage);
    if (!state.hp) state.recoverAt = now + BOXING.recoveryMs;
    else if (now >= state.counterAt) {
      state.counterAt = now + BOXING.counterDelayMs;
      state.hits.push({ id: requestId + '-fish', attacker: FISH_ID, target: id, at: now });
    }
  }
  state.hits = [...state.hits.filter((event) => now - event.at < 1300), hit];
  return hit;
}

export function boxingView(state: BoxingState, fighters: Record<string, Presence>, merit: number, now: number): BoxingView {
  return { fighters: activeFighters(fighters, now), hits: state.hits.filter((event) => now - event.at < 1300),
    fishHp: state.hp, fishRecoverAt: state.recoverAt, merit, serverTime: now };
}
